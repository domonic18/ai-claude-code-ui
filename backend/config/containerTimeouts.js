/**
 * 容器超时与备份配置模块
 *
 * 包含所有超时配置（容器、PTY、Codex、文件操作、认证会话）和备份配置。
 *
 * @module config/containerTimeouts
 */

import path from 'path';
import { PROJECT_ROOT } from './envLoader.js';

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
