/**
 * 容器配置构建器
 *
 * 负责构建 Docker 容器的完整配置，包括环境变量、
 * 资源限制、网络配置和挂载点。
 *
 * @module container/core/ContainerConfig
 */

import { RESOURCE_LIMITS, CONTAINER } from '../../../config/config.js';
import fs from 'fs';

/**
 * 容器配置构建器类
 */
export class ContainerConfigBuilder {
  /**
   * 构建容器配置
   * @param {object} options - 配置选项
   * @param {string} options.name - 容器名称
   * @param {string} options.userDataDir - 用户数据目录路径
   * @param {number} options.userId - 用户 ID
   * @param {object} options.userConfig - 用户配置
   * @param {string} options.image - Docker 镜像名称
   * @param {string} options.network - 网络模式
   * @returns {object} Docker 容器配置
   */
  buildConfig(options) {
    const { name, userDataDir, userId, userConfig, image, network } = options;
    const tier = userConfig.tier || 'free';
    const resourceLimits = RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;

    // 使用命名卷支持 Docker-in-Docker 环境
    // 命名卷在 Docker 层级，所有容器都能访问
    const volumeName = `claude-user-${userId}-workspace`;

    return {
      name: name,
      Image: image,
      // 关键配置：启用 TTY 和 stdin 以支持交互式 shell attach
      // 这是使用 container.attach() 获取可写流的必要条件
      Tty: true,
      OpenStdin: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      // 容器主命令：交互式 shell
      // 这样 container.attach() 可以获取到可写的 shell 流
      // 每个用户有独立的容器，所以不会有多用户冲突
      Cmd: ['/bin/sh', '-c', 'exec /bin/sh -i 2>&1'],
      Env: this._buildEnvironment(userId, tier),
      HostConfig: {
        // 使用命名卷而不是 bind mount，支持 Docker-in-Docker 环境
        // 格式：卷名:容器路径:选项
        Binds: [
          `${volumeName}:${CONTAINER.paths.workspace}:rw`,      // 用户工作区命名卷
          '/var/run/docker.sock:/var/run/docker.sock:rw'        // Docker socket
        ],
        Memory: resourceLimits.memory,
        CpuQuota: resourceLimits.cpuQuota,
        CpuPeriod: resourceLimits.cpuPeriod,
        NetworkMode: network,
        ReadonlyRootfs: false,
        // Seccomp 安全策略：直接传递 JSON 对象
        Seccomp: this._loadSeccompProfile(),
        // AppArmor 和其他安全选项
        SecurityOpt: this._buildSecurityOptions(),
        LogConfig: {
          Type: 'json-file',
          Config: {
            'max-size': '10m',
            'max-file': '3'
          }
        }
      },
      // 定义容器内的挂载点（Docker API 要求）
      Volumes: {
        [CONTAINER.paths.workspace]: {}
      },
      Labels: this._buildLabels(userId, tier, volumeName)
    };
  }

  /**
   * 加载 Seccomp 安全配置
   * @returns {object|null} Seccomp 配置对象，如果文件不存在则返回 null
   * @private
   */
  _loadSeccompProfile() {
    try {
      const seccompPath = CONTAINER.security.seccompProfile;
      const content = fs.readFileSync(seccompPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`[ContainerConfig] Failed to load seccomp profile: ${error.message}`);
      // 返回 undefined 将使用 Docker 默认 seccomp profile
      return undefined;
    }
  }

  /**
   * 构建容器安全选项
   * @returns {Array<string>} 安全选项数组
   * @private
   */
  _buildSecurityOptions() {
    const securityOptions = [];

    // AppArmor 配置：强制访问控制
    // 注意：AppArmor 配置需要先在系统上加载：
    //   sudo apparmor_parser -r workspace/containers/apparmor/docker-claude-code
    // 如果 AppArmor 未安装或未加载，Docker 会忽略此选项并使用默认配置
    securityOptions.push(`apparmor=${CONTAINER.security.apparmorProfile}`);

    // 禁止提权：防止进程通过 exec 系统调用获得新的权限
    securityOptions.push('no-new-privileges');

    return securityOptions;
  }

  /**
   * 构建容器环境变量
   * @param {number} userId - 用户 ID
   * @param {string} tier - 用户层级
   * @returns {Array<string>} 环境变量数组
   * @private
   */
  _buildEnvironment(userId, tier) {
    const containerEnv = [
      // 关键配置：设置 HOME 指向 /workspace/my-workspace
      // 这样 ~/.claude/ = /workspace/my-workspace/.claude/，确保 SDK 能正确加载自定义 Skills
      // 注意：扩展文件通过 putArchive 解压到 /workspace/my-workspace/.claude/
      `HOME=/workspace/my-workspace`,
      `USER_ID=${userId}`,
      `NODE_ENV=production`,
      `USER_TIER=${tier}`,
      `CLAUDE_CONFIG_DIR=${CONTAINER.paths.claudeConfig}`,           // Claude 配置目录
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`
    ];

    // 从宿主机环境变量中传递 API 配置到容器
    // SDK 需要这些环境变量才能正常工作
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    if (authToken) {
      containerEnv.push(`ANTHROPIC_AUTH_TOKEN=${authToken}`);
    }

    if (process.env.ANTHROPIC_BASE_URL) {
      containerEnv.push(`ANTHROPIC_BASE_URL=${process.env.ANTHROPIC_BASE_URL}`);
    }

    if (process.env.ANTHROPIC_MODEL) {
      containerEnv.push(`ANTHROPIC_MODEL=${process.env.ANTHROPIC_MODEL}`);
    }

    return containerEnv;
  }

  /**
   * 构建容器标签
   * @param {number} userId - 用户 ID
   * @param {string} tier - 用户层级
   * @param {string} volumeName - 命名卷名称
   * @returns {object} 标签对象
   * @private
   */
  _buildLabels(userId, tier, volumeName) {
    return {
      // Docker Compose 风格标签 - 用于在 Docker 客户端中分组显示
      'com.docker.compose.project': 'claude-code-ui',
      'com.docker.compose.service': 'user-sandbox',
      'com.docker.compose.oneoff': 'false',

      // 自定义标签 - 用于容器识别和管理
      'com.claude-code.user': String(userId),
      'com.claude-code.managed': 'true',
      'com.claude-code.tier': tier,
      'com.claude-code.volume': volumeName,
      'com.claude-code.created': new Date().toISOString()
    };
  }

  /**
   * 构建执行配置
   * @param {string} command - 要执行的命令
   * @param {object} options - 执行选项
   * @param {boolean} options.stdin - 是否附加标准输入
   * @param {boolean} options.tty - 是否使用 TTY
   * @param {string} options.cwd - 工作目录
   * @param {object} options.env - 环境变量
   * @returns {object} 执行配置
   */
  buildExecConfig(command, options = {}) {
    return {
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: !!options.stdin,
      Tty: options.tty || false,
      WorkingDir: options.cwd || CONTAINER.paths.workspace,
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : []
    };
  }
}
