/**
 * 容器与资源限制配置模块
 *
 * 包含 Docker 容器配置、资源限制（按用户层级）、超时配置、备份配置。
 *
 * @module config/containerConfig
 */

import path from 'path';
import { PROJECT_ROOT } from './envLoader.js';

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
    // Claude 配置根目录（指向项目工作区，以便 SDK 能读取 customAgents）
    // 注意：SDK 的 CLAUDE_CONFIG_DIR 决定了 settings.json 的读取位置
    claudeConfig: '/workspace/my-workspace/.claude',
    // 设置文件
    settings: '/workspace/my-workspace/.claude/settings.json',
    // API 密钥文件（保留用于兼容性）
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
 * 根据用户层级定义 CPU、内存等资源限制
 */
export const RESOURCE_LIMITS = {
  free: {
    memory: 1 * 1024 * 1024 * 1024,  // 1GB
    cpuQuota: 50000,                  // 0.5 CPU
    cpuPeriod: 100000,
    securityOptions: []
  },
  pro: {
    memory: 4 * 1024 * 1024 * 1024,  // 4GB
    cpuQuota: 200000,                 // 2 CPU
    cpuPeriod: 100000,
    securityOptions: []
  },
  enterprise: {
    memory: 8 * 1024 * 1024 * 1024,  // 8GB
    cpuQuota: 400000,                 // 4 CPU
    cpuPeriod: 100000,
    securityOptions: []
  }
};

/**
 * 容器超时配置
 */
export const CONTAINER_TIMEOUTS = {
  // 等待容器就绪的超时时间（毫秒）
  ready: parseInt(process.env.CONTAINER_READY_TIMEOUT || '120000', 10),

  // 等待容器移除的超时时间（毫秒）
  remove: parseInt(process.env.CONTAINER_REMOVE_TIMEOUT || '10000', 10),

  // 停止容器的超时时间（毫秒）
  stop: parseInt(process.env.CONTAINER_STOP_TIMEOUT || '10000', 10),

  // 容器健康检查超时时间（毫秒）
  healthCheck: parseInt(process.env.CONTAINER_HEALTH_CHECK_TIMEOUT || '60000', 10),

  // 空闲容器清理阈值（毫秒）
  idleCleanup: parseInt(process.env.CONTAINER_IDLE_CLEANUP || '7200000', 10), // 2 小时

  // 容器清理检查间隔（毫秒）
  cleanupInterval: parseInt(process.env.CONTAINER_CLEANUP_INTERVAL || '1800000', 10), // 30 分钟
};

/**
 * PTY 会话超时配置
 */
export const PTY_TIMEOUTS = {
  // PTY 会话超时时间（毫秒）
  sessionTimeout: parseInt(process.env.PTY_SESSION_TIMEOUT || '1800000', 10), // 30 分钟

  // PTY 空闲清理阈值（毫秒）
  idleCleanup: parseInt(process.env.PTY_IDLE_CLEANUP || '3600000', 10), // 1 小时

  // PTY 清理检查间隔（毫秒）
  cleanupInterval: parseInt(process.env.PTY_CLEANUP_INTERVAL || '1800000', 10), // 30 分钟
};

/**
 * Codex 会话超时配置
 */
export const CODEX_TIMEOUTS = {
  // 已完成会话保留时间（毫秒）
  completedSessionAge: parseInt(process.env.CODEX_COMPLETED_SESSION_AGE || '1800000', 10), // 30 分钟

  // Codex 清理检查间隔（毫秒）
  cleanupInterval: parseInt(process.env.CODEX_CLEANUP_INTERVAL || '300000', 10), // 5 分钟
};

/**
 * 文件操作超时配置
 */
export const FILE_TIMEOUTS = {
  // 默认文件操作超时（毫秒）
  default: parseInt(process.env.FILE_OPERATION_TIMEOUT || '3000', 10), // 3 秒

  // 流读取超时（毫秒）
  streamRead: parseInt(process.env.STREAM_READ_TIMEOUT || '5000', 10), // 5 秒

  // 前端快速请求超时（毫秒）
  // 用于前端轮询等需要快速响应的场景
  quickRequest: parseInt(process.env.QUICK_REQUEST_TIMEOUT || '5000', 10), // 5 秒
};

/**
 * 认证会话配置
 */
export const SESSION_TIMEOUTS = {
  // Cookie 过期时间（毫秒）
  cookieMaxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE || '31536000000', 10), // 1 年
};

/**
 * 备份配置
 */
export const BACKUP = {
  // 是否启用自动备份
  enabled: process.env.BACKUP_ENABLED !== 'false',

  // 备份目录
  dir: process.env.BACKUP_DIR || path.join(PROJECT_ROOT, 'workspace', 'backups'),

  // 保留策略
  retention: {
    daily: parseInt(process.env.BACKUP_RETENTION_DAILY || '7', 10),
    weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY || '4', 10),
    monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY || '3', 10),
  },
};
