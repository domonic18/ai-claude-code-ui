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

/**
 * 获取项目根目录的绝对路径
 */
export function getProjectRoot() {
  return PROJECT_ROOT;
}

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

/**
 * 获取用户数据目录的绝对路径
 * @param {number} userId - 用户 ID
 */
export function getUserDataDir(userId) {
  return path.join(getWorkspaceDir(), 'users', `user_${userId}`, 'data');
}

/**
 * 检查是否为平台模式
 */
export function isPlatformMode() {
  return SERVER.isPlatform;
}

/**
 * 获取资源限制配置
 * @param {string} tier - 用户层级 (free, pro, enterprise)
 */
export function getResourceLimits(tier = 'free') {
  return RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;
}

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

/**
 * 记录配置状态到控制台
 */
export function logConfigStatus() {
  logger.info(`${c.info('[CONFIG]')} ===== 配置状态 =====`);
  logger.info(`${c.info('[CONFIG]')} 模式: ${c.bright(SERVER.isPlatform ? 'PLATFORM (单用户)' : 'STANDARD (多用户)')}`);
  logger.info(`${c.info('[CONFIG]')} 容器模式: ${c.ok('启用 (容器化架构)')}`);
  logger.info(`${c.info('[CONFIG]')} 数据库: ${c.dim(DATABASE.path)}`);
  logger.info(`${c.info('[CONFIG]')} 端口: ${c.bright(SERVER.port)}`);

  if (SERVER.env === 'production') {
    if (AUTH.jwtSecret === 'claude-ui-dev-secret-change-in-production') {
      logger.info(`${c.warn('[WARN]')} 使用默认 JWT 密钥，请在生产环境中设置 JWT_SECRET`);
    }
  }

  logger.info(`${c.info('[CONFIG]')} ====================`);
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
