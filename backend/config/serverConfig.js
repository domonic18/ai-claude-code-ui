/**
 * 服务器与基础配置模块
 *
 * 包含服务器、数据库、认证、CORS、文件操作、WebSocket、日志、SDK 等配置。
 * 所有配置从环境变量读取，提供合理默认值。
 *
 * @module config/serverConfig
 */

import path from 'path';
import { PROJECT_ROOT } from './envLoader.js';

/**
 * 服务器配置
 */
export const SERVER = {
  // 端口配置
  port: parseInt(process.env.PORT || '3001', 10),

  // 运行环境
  env: process.env.NODE_ENV || 'production',

  // 是否为平台模式（单用户模式）
  isPlatform: process.env.VITE_IS_PLATFORM === 'true',

  // Vite 开发服务器端口（开发模式）
  vitePort: parseInt(process.env.VITE_PORT || '5173', 10),

  // 健康检查端口（容器入口点）
  healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3001', 10),
};

/**
 * 数据库配置
 */
export const DATABASE = {
  // 数据库文件路径
  path: process.env.DATABASE_PATH || path.join(PROJECT_ROOT, 'workspace', 'database', 'auth.db'),

  // 数据库目录
  dir: path.dirname(process.env.DATABASE_PATH || path.join(PROJECT_ROOT, 'workspace', 'database', 'auth.db')),
};

/**
 * 认证配置
 */
export const AUTH = {
  // JWT 密钥（生产环境必须设置）
  jwtSecret: process.env.JWT_SECRET || 'claude-ui-dev-secret-change-in-production',

  // API 密钥（可选，用于额外的 API 访问控制）
  apiKey: process.env.API_KEY || null,

  // JWT 过期时间
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

/**
 * CORS 配置
 */
export const CORS = {
  // 允许的源（逗号分隔）
  origins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3001'],
};

/**
 * Claude CLI 配置
 */
export const CLAUDE = {
  // CLI 路径
  cliPath: process.env.CLAUDE_CLI_PATH || 'claude',

  // 配置目录
  configDir: process.env.CLAUDE_CONFIG_DIR || null,

  // 上下文窗口大小
  contextWindow: parseInt(process.env.CONTEXT_WINDOW || '200000', 10),
};

/**
 * 文件操作配置
 */
export const FILES = {
  // 最大上传大小
  maxUploadSize: process.env.MAX_UPLOAD_SIZE || '50mb',

  // 支持的文件类型
  allowedExtensions: process.env.ALLOWED_EXTENSIONS
    ? process.env.ALLOWED_EXTENSIONS.split(',')
    : ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.css', '.html', '.md', '.json', '.yaml', '.yml', '.txt', '.sh'],

  // 排除的目录（文件树遍历时）
  excludedDirs: ['.git', 'node_modules', 'dist', 'build', '.next', '.nuxt', 'target', 'bin', 'obj'],

  // 最大文件深度
  maxDepth: parseInt(process.env.MAX_FILE_DEPTH || '3', 10),
};

/**
 * WebSocket 配置
 */
export const WEBSOCKET = {
  // 心跳间隔（毫秒）
  heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),

  // 连接超时（毫秒）
  timeout: parseInt(process.env.WS_TIMEOUT || '120000', 10),
};

/**
 * 日志配置
 */
export const LOG = {
  // 日志级别
  level: process.env.LOG_LEVEL || 'info',

  // 日志目录（符合 docs/arch/data-storage-design.md，位于 workspace/logs）
  dir: process.env.LOG_DIR || path.join(PROJECT_ROOT, 'workspace', 'logs'),
};

/**
 * SDK 执行配置
 */
export const SDK = {
  // SDK 执行超时时间（毫秒）
  // 0 表示禁用超时限制，适用于长时间运行的复杂任务
  // 默认 24 小时 (86400000ms)，适合长时间运行的复杂任务（生成技术方案、论文等）
  executionTimeout: parseInt(process.env.SDK_EXECUTION_TIMEOUT || '86400000', 10),
};
