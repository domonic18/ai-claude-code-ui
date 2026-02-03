/**
 * 统一配置模块
 *
 * 集中管理所有应用配置，包括环境变量、默认值、资源限制等。
 * 所有配置相关的定义都应该在此文件中维护。
 *
 * @module config/config
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// config.js 位于 backend/config/，需要向上两级到达项目根目录
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ============================================================================
// 首先加载环境变量（必须在任何配置读取之前）
// ============================================================================

/**
 * 从 .env 文件加载环境变量
 * 如果环境变量尚不存在，则设置它们
 */
export function loadEnvironment() {
  try {
    const envPath = path.join(PROJECT_ROOT, '.env');
    console.log(`[CONFIG] Loading environment from: ${envPath}`);

    // 检查文件是否存在
    if (!fs.existsSync(envPath)) {
      console.log(`[CONFIG] .env file not found at ${envPath}`);
      return;
    }

    const envFile = fs.readFileSync(envPath, 'utf8');
    let loadedCount = 0;

    envFile.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // 只有当变量未设置时才从 .env 加载（允许环境变量覆盖 .env）
          if (process.env[key] === undefined) {
            process.env[key] = value;
            loadedCount++;
          } else {
            console.log(`[CONFIG] Skipping ${key} (already set in environment)`);
          }
        }
      }
    });

    console.log(`[CONFIG] Loaded ${loadedCount} environment variables from .env`);

    // 关键变量检查
    const criticalVars = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL'];
    console.log('[CONFIG] Critical environment variables status:');
    criticalVars.forEach(varName => {
      const isSet = !!process.env[varName];
      const value = isSet ? (varName.includes('TOKEN') || varName.includes('KEY')
        ? `${process.env[varName].substring(0, 10)}...`
        : process.env[varName])
        : 'NOT SET';
      console.log(`[CONFIG] - ${varName}: ${value}`);
    });
  } catch (e) {
    console.error(`[CONFIG] Error loading .env file: ${e.message}`);
    // 继续执行，使用默认值
  }
}

// 立即加载环境变量，确保配置常量能读取到正确的值
loadEnvironment();

// ============================================================================
// 环境变量配置与默认值
// ============================================================================

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
  image: process.env.CONTAINER_IMAGE || 'claude-code-runtime:latest',

  // Docker 网络
  network: process.env.CONTAINER_NETWORK || 'claude-network',

  // 容器内路径规范（符合 docs/arch/data-storage-design.md v3.1）
  paths: {
    // 统一工作目录（通过 HOME=/workspace，~ 也指向此目录）
    workspace: '/workspace',
    // Claude 配置根目录（用户级配置，~/.claude/）
    claudeConfig: '/workspace/.claude',
    // 设置文件
    settings: '/workspace/.claude/settings.json',
    // API 密钥文件（保留用于兼容性）
    apiKeys: '/workspace/.claude/api_keys.json',
    // 项目元数据目录（注意：官方文档未明确说明，保留用于路径验证）
    // 此目录可能由 SDK 自动管理用于会话元数据
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

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取项目根目录的绝对路径
 */
export function getProjectRoot() {
  return PROJECT_ROOT;
}

/**
 * 获取 workspace 目录的绝对路径
 */
export function getWorkspaceDir() {
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

// ============================================================================
// ANSI 颜色配置（用于终端输出）
// ============================================================================

/**
 * ANSI 颜色代码
 */
export const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

/**
 * 彩色控制台输出工具
 */
export const c = {
  info: (text) => `${COLORS.cyan}${text}${COLORS.reset}`,
  ok: (text) => `${COLORS.green}${text}${COLORS.reset}`,
  warn: (text) => `${COLORS.yellow}${text}${COLORS.reset}`,
  error: (text) => `${COLORS.red}${text}${COLORS.reset}`,
  tip: (text) => `${COLORS.blue}${text}${COLORS.reset}`,
  bright: (text) => `${COLORS.bright}${text}${COLORS.reset}`,
  dim: (text) => `${COLORS.dim}${text}${COLORS.reset}`,
};

/**
 * 记录配置状态到控制台
 */
export function logConfigStatus() {
  console.log(`${c.info('[CONFIG]')} ===== 配置状态 =====`);
  console.log(`${c.info('[CONFIG]')} 模式: ${c.bright(SERVER.isPlatform ? 'PLATFORM (单用户)' : 'STANDARD (多用户)')}`);
  console.log(`${c.info('[CONFIG]')} 容器模式: ${c.ok('启用 (容器化架构)')}`);
  console.log(`${c.info('[CONFIG]')} 数据库: ${c.dim(DATABASE.path)}`);
  console.log(`${c.info('[CONFIG]')} 端口: ${c.bright(SERVER.port)}`);

  if (SERVER.env === 'production') {
    if (AUTH.jwtSecret === 'claude-ui-dev-secret-change-in-production') {
      console.log(`${c.warn('[WARN]')} 使用默认 JWT 密钥，请在生产环境中设置 JWT_SECRET`);
    }
  }

  console.log(`${c.info('[CONFIG]')} ====================`);
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
