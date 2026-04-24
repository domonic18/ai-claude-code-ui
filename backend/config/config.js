/**
 * 统一配置模块（入口）
 *
 * 集中管理所有应用配置，作为唯一的对外导出点。
 * 具体配置分散到子模块中维护：
 * - envLoader — 环境变量加载
 * - serverConfig — 服务器、数据库、认证、CORS、文件、WebSocket、日志、SDK 配置
 * - containerConfig — 容器、资源限制、各类超时、备份配置
 * - modelConfig — AI 模型配置
 * - consoleUtils — ANSI 颜色和控制台工具
 *
 * @module config/config
 */

import path from 'path';
import { createLogger } from '../utils/logger.js';

// 立即加载环境变量，确保配置常量能读取到正确的值
import { loadEnvironment, PROJECT_ROOT } from './envLoader.js';
loadEnvironment();

// 从子模块导入所有配置
import { SERVER, DATABASE, AUTH, CORS, CLAUDE, FILES, WEBSOCKET, LOG, SDK } from './serverConfig.js';
import {
  CONTAINER, RESOURCE_LIMITS,
  CONTAINER_TIMEOUTS, PTY_TIMEOUTS, CODEX_TIMEOUTS, FILE_TIMEOUTS, SESSION_TIMEOUTS,
  BACKUP
} from './containerConfig.js';
import { MODELS } from './modelConfig.js';
import { COLORS, c } from './consoleUtils.js';

const logger = createLogger('config/config');

// 重导出所有配置常量
export {
  SERVER, DATABASE, AUTH, CORS, CLAUDE, FILES, WEBSOCKET, LOG, SDK,
  CONTAINER, RESOURCE_LIMITS,
  CONTAINER_TIMEOUTS, PTY_TIMEOUTS, CODEX_TIMEOUTS, FILE_TIMEOUTS, SESSION_TIMEOUTS,
  BACKUP,
  MODELS,
  COLORS, c,
  loadEnvironment
};

// ─── 辅助函数 ──────────────────────────────────────────

// 用于获取项目根目录的绝对路径，主要用于文件路径拼接
/**
 * 获取项目根目录的绝对路径
 */
export function getProjectRoot() {
  return PROJECT_ROOT;
}

// 用于获取 workspace 目录的绝对路径，主要用于容器内工作目录定位
/**
 * 获取 workspace 目录的绝对路径
 * 优先使用 WORKSPACE_DIR 环境变量（用于 Docker 部署）
 */
export function getWorkspaceDir() {
  // 在 Docker 部署环境中，使用 WORKSPACE_DIR 环境变量
  // 这样可以与命名卷挂载点保持一致
  if (process.env.WORKSPACE_DIR) {
    return process.env.WORKSPACE_DIR;
  }
  return path.join(PROJECT_ROOT, 'workspace');
}

// 用于获取用户数据目录的绝对路径，主要用于存储用户专属文件
/**
 * 获取用户数据目录的绝对路径
 * @param {number} userId - 用户 ID
 */
export function getUserDataDir(userId) {
  return path.join(getWorkspaceDir(), 'users', `user_${userId}`, 'data');
}

// 用于检查当前运行模式是否为平台模式（单用户模式）
/**
 * 检查是否为平台模式
 */
export function isPlatformMode() {
  return SERVER.isPlatform;
}

// 用于获取指定用户层级的资源限制配置，主要用于容器创建时的资源分配
/**
 * 获取资源限制配置
 * @param {string} tier - 用户层级 (free, pro, enterprise)
 */
export function getResourceLimits(tier = 'free') {
  return RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;
}

// 用于验证生产环境中的必需配置项是否已设置，防止配置错误导致安全问题
/**
 * 验证必需的配置
 * 在生产环境中检查必需的配置项是否已设置
 * @throws {Error} 如果缺少必需的配置
 */
export function validateConfig() {
  const errors = [];

  if (SERVER.env === 'production') {
    if (AUTH.jwtSecret === 'claude-ui-dev-secret-change-in-production') {
      errors.push('JWT_SECRET must be set in production environment');
    }
  }

  if (errors.length > 0) {
    throw new Error('Configuration validation failed:\n  - ' + errors.join('\n  - '));
  }
}

// 用于获取配置摘要信息，主要用于日志记录和状态监控
/**
 * 获取配置摘要（用于日志和状态显示）
 */
export function getConfigSummary() {
  return {
    server: {
      port: SERVER.port,
      env: SERVER.env,
      isPlatform: SERVER.isPlatform,
    },
    database: {
      path: DATABASE.path,
    },
    container: {
      image: CONTAINER.image,
      network: CONTAINER.network,
    },
    auth: {
      hasApiKey: !!AUTH.apiKey,
      jwtExpiresIn: AUTH.jwtExpiresIn,
    },
  };
}

// 用于将配置状态记录到控制台，主要用于启动时的配置确认
/**
 * 记录配置状态到控制台
 */
export function logConfigStatus() {
  logger.info('===== 配置状态 =====');
  logger.info({ mode: SERVER.isPlatform ? 'PLATFORM' : 'STANDARD', containerized: true, database: DATABASE.path, port: SERVER.port }, 'Configuration loaded');

  if (SERVER.env === 'production') {
    if (AUTH.jwtSecret === 'claude-ui-dev-secret-change-in-production') {
      logger.warn('Using default JWT secret — set JWT_SECRET in production');
    }
  }
}

// 默认导出所有配置
export default {
  SERVER,
  DATABASE,
  AUTH,
  CORS,
  CONTAINER,
  RESOURCE_LIMITS,
  CLAUDE,
  MODELS,
  FILES,
  WEBSOCKET,
  LOG,
  SDK,
  CONTAINER_TIMEOUTS,
  PTY_TIMEOUTS,
  CODEX_TIMEOUTS,
  FILE_TIMEOUTS,
  SESSION_TIMEOUTS,
  BACKUP,
  COLORS,
  c,
  loadEnvironment,
  getProjectRoot,
  getWorkspaceDir,
  getUserDataDir,
  isPlatformMode,
  getResourceLimits,
  validateConfig,
  getConfigSummary,
  logConfigStatus,
};
