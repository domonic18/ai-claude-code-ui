/**
 * 容器配置构建器
 *
 * 负责构建 Docker 容器的完整配置，包括环境变量、
 * 资源限制、网络配置和挂载点。
 *
 * @module container/core/ContainerConfig
 */

import { RESOURCE_LIMITS, CONTAINER } from '../../../config/config.js';

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

    return {
      name: name,
      Image: image,
      Env: this._buildEnvironment(userId, tier),
      HostConfig: {
        // 单一挂载点：所有数据统一在 /workspace 下
        Binds: [
          `${userDataDir}:${CONTAINER.paths.workspace}:rw`    // 统一工作目录
        ],
        Memory: resourceLimits.memory,
        CpuQuota: resourceLimits.cpuQuota,
        CpuPeriod: resourceLimits.cpuPeriod,
        NetworkMode: network,
        ReadonlyRootfs: false,
        LogConfig: {
          Type: 'json-file',
          Config: {
            'max-size': '10m',
            'max-file': '3'
          }
        }
      },
      Labels: this._buildLabels(userId, tier)
    };
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
      `USER_ID=${userId}`,
      `NODE_ENV=production`,
      `USER_TIER=${tier}`,
      `CLAUDE_CONFIG_DIR=${CONTAINER.paths.claudeConfig}`,           // Claude 配置目录
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`
    ];


    return containerEnv;
  }

  /**
   * 构建容器标签
   * @param {number} userId - 用户 ID
   * @param {string} tier - 用户层级
   * @returns {object} 标签对象
   * @private
   */
  _buildLabels(userId, tier) {
    return {
      // Docker Compose 风格标签 - 用于在 Docker 客户端中分组显示
      'com.docker.compose.project': 'claude-code-ui',
      'com.docker.compose.service': 'user-sandbox',
      'com.docker.compose.oneoff': 'false',

      // 自定义标签 - 用于容器识别和管理
      'com.claude-code.user': String(userId),
      'com.claude-code.managed': 'true',
      'com.claude-code.tier': tier,
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
