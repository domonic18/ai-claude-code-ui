/**
 * 容器与资源限制配置模块
 *
 * 包含 Docker 容器配置、资源限制（按用户层级）、超时配置、备份配置。
 *
 * @module config/containerConfig
 */

import path from 'path';
import { PROJECT_ROOT } from './envLoader.js';
import { getResourceLimits } from './containerTierConfig.js';

/**
 * 系统保留目录名（在 /workspace/ 下不应被识别为用户项目的目录）
 * DocumentService、ContainerProjectManager 等模块应引用此常量，避免硬编码不一致
 */
export const RESERVED_DIR_NAMES = ['generated_docs', 'logs', '.claude', 'user-prompt'];

/**
 * AI 生成文档的目录名（相对于项目根目录）
 */
export const GENERATED_DIR_NAME = 'generated_docs';

/**
 * 容器配置
 *
 * 注意：项目现在完全基于容器化运行，所有操作都在 Docker 容器中执行。
 */
export const CONTAINER = {
  // Docker 配置
  docker: {
    host: process.env.DOCKER_HOST || null,
    socketPath: process.platform !== 'darwin' ? '/var/run/docker.sock' : null,
    certPath: process.env.DOCKER_CERT_PATH || null,
  },

  // Docker 镜像
  image: process.env.CONTAINER_IMAGE || 'claude-code-sandbox:latest',

  // Docker 网络
  network: process.env.CONTAINER_NETWORK || 'claude-code-network',

  // 容器内路径规范
  paths: {
    // 统一工作目录
    workspace: '/workspace',
    // Claude 配置根目录（仅用于默认项目 my-workspace 的容器初始化 env）
    // 注意：SDK 执行时由 DockerExecutor.js 覆盖为 /workspace/.claude
    claudeConfig: '/workspace/my-workspace/.claude',
    // 设置文件（仅用于默认项目初始化）
    settings: '/workspace/my-workspace/.claude/settings.json',
    // API 密钥文件（仅用于默认项目初始化）
    apiKeys: '/workspace/my-workspace/.claude/api_keys.json',
    // 项目元数据目录
    projects: '/workspace/.claude/projects',
  },

  // 宿主机安全策略文件路径
  security: {
    // Seccomp 配置文件路径（系统调用过滤）
    seccompProfile: process.env.SECCOMP_PROFILE || path.join(PROJECT_ROOT, 'workspace/containers/seccomp/claude-code.json'),
    // AppArmor 配置文件名称（需要在系统上预加载）
    apparmorProfile: process.env.APPARMOR_PROFILE || 'docker-claude-code',
  }
};

/**
 * 容器资源限制配置
 * 从 containerTierConfig.js 导入
 * @deprecated 使用 getResourceLimits(tier) 函数代替
 */
export { getResourceLimits, RESOURCE_LIMITS } from './containerTierConfig.js';

/**
 * 超时与备份配置
 * 从 containerTimeouts.js 导入以降低文件复杂度
 */
export {
  CONTAINER_TIMEOUTS,
  PTY_TIMEOUTS,
  CODEX_TIMEOUTS,
  FILE_TIMEOUTS,
  SESSION_TIMEOUTS,
  BACKUP
} from './containerTimeouts.js';
