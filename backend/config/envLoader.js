/**
 * 环境变量加载模块
 *
 * 从 .env 文件加载环境变量，支持优先级查找和显式指定。
 * 必须在任何配置读取之前调用。
 *
 * 查找优先级：
 * 1. ENV_FILE 环境变量显式指定的文件（最高优先）
 * 2. .env（通用默认）
 * 3. .env.deploy（双镜像部署专用）
 *
 * @module config/envLoader
 */

import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('config/envLoader');

// envLoader.js 位于 backend/config/，需要向上两级到达项目根目录
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const ENV_FILE_CANDIDATES = ['.env', '.env.deploy'];

/**
 * 查找环境文件路径
 * 按 ENV_FILE > .env > .env.deploy 的优先级查找
 * @returns {{ path: string, name: string } | null} 找到的文件路径，或 null
 */
function findEnvFile() {
  if (process.env.ENV_FILE) {
    const explicitPath = path.join(PROJECT_ROOT, process.env.ENV_FILE);
    if (fs.existsSync(explicitPath)) {
      return { path: explicitPath, name: process.env.ENV_FILE };
    }
    logger.info(`[CONFIG] ENV_FILE specified but not found: ${explicitPath}`);
  }

  for (const candidate of ENV_FILE_CANDIDATES) {
    const candidatePath = path.join(PROJECT_ROOT, candidate);
    if (fs.existsSync(candidatePath)) {
      return { path: candidatePath, name: candidate };
    }
  }

  return null;
}

/**
 * 从 .env 文件内容中加载变量到 process.env
 * 只加载尚未设置的变量（环境变量优先于文件配置）
 * @param {string} content - 文件内容
 * @returns {number} 加载的变量数量
 */
function loadEnvVars(content) {
  let loadedCount = 0;

  content.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;

    const [key, ...valueParts] = trimmedLine.split('=');
    if (!key || valueParts.length === 0) return;

    const value = valueParts.join('=').trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loadedCount++;
    } else {
      logger.info(`[CONFIG] Skipping ${key} (already set in environment)`);
    }
  });

  return loadedCount;
}

/**
 * 格式化关键变量的显示值（隐藏敏感信息）
 * @param {string} varName - 变量名
 * @returns {string} 安全的显示值
 */
function formatSafeValue(varName) {
  const value = process.env[varName];
  if (!value) return 'NOT SET';
  if (varName.includes('TOKEN') || varName.includes('KEY')) {
    return `${value.substring(0, 10)}...`;
  }
  if (varName === 'AVAILABLE_MODELS') {
    return `${value.substring(0, 50)}...`;
  }
  return value;
}

/**
 * 从环境文件加载环境变量
 * 如果环境变量尚不存在，则设置它们
 * 按优先级自动查找第一个存在的环境文件，也支持 ENV_FILE 环境变量显式指定
 */
export function loadEnvironment() {
  try {
    const envFile = findEnvFile();
    if (!envFile) {
      logger.info('[CONFIG] No environment file found (tried: .env, .env.deploy)');
      return;
    }

    logger.info(`[CONFIG] Loading environment from: ${envFile.path}`);

    const content = fs.readFileSync(envFile.path, 'utf8');
    const loadedCount = loadEnvVars(content);

    logger.info(`[CONFIG] Loaded ${loadedCount} environment variables from ${envFile.name}`);

    // 关键变量检查
    const criticalVars = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'AVAILABLE_MODELS'];
    logger.info('[CONFIG] Critical environment variables status:');
    criticalVars.forEach(varName => {
      logger.info(`[CONFIG] - ${varName}: ${formatSafeValue(varName)}`);
    });
  } catch (e) {
    logger.error(`[CONFIG] Error loading .env file: ${e.message}`);
  }
}
