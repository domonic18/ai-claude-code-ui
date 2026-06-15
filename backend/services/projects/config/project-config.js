/**
 * 项目配置管理（按用户隔离）
 *
 * 存储项目自定义显示名称、手动添加的项目等元数据。
 *
 * 持久化路径：{workspaceDir}/.claude/project-configs/user-{userId}.json
 *   - workspaceDir 由 getWorkspaceDir() 解析（Docker 部署为持久卷 /workspace，
 *     由 docker-compose 的 claude-code-data 卷挂载，主容器重建后保留）。
 *   - 每个用户一个独立文件，按 userId 隔离，避免跨用户同名项目互相覆盖显示名。
 *
 * 为什么不用 os.homedir()/.claude/project-config.json（旧设计）：
 *   1. 落在容器可写层，主容器 down/up 重建时丢失，用户改过的显示名变回原名。
 *   2. 全局单文件，所有用户共用，跨用户同名项目的显示名会互相串。
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getWorkspaceDir } from '../../../config/config.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/projects/config/project-config');

const CONFIGS_DIR = path.join(getWorkspaceDir(), '.claude', 'project-configs');

/**
 * 获取指定用户的项目配置文件路径
 * @param {number} userId - 用户 ID
 * @returns {string} 配置文件绝对路径
 */
function getConfigPath(userId) {
  return path.join(CONFIGS_DIR, `user-${userId}.json`);
}

// 在应用启动或需要读取项目元数据时调用，从持久卷加载指定用户的项目配置
/**
 * 加载指定用户的项目配置文件
 * @param {number} userId - 用户 ID
 * @returns {Promise<Object>} 项目配置对象
 */
async function loadProjectConfig(userId) {
  const configPath = getConfigPath(userId);
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // Return empty config if file doesn't exist
    return {};
  }
}

// 在项目元数据更新时调用，将指定用户的配置持久化到持久卷
/**
 * 保存指定用户的项目配置文件
 * @param {number} userId - 用户 ID
 * @param {Object} config - 项目配置对象
 * @returns {Promise<void>}
 */
async function saveProjectConfig(userId, config) {
  // Ensure the project-configs directory exists
  try {
    await fs.mkdir(CONFIGS_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  const configPath = getConfigPath(userId);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// 在删除用户/项目时调用，清理指定用户的项目配置文件
/**
 * 删除指定用户的项目配置文件（如用户被删除时调用）
 * @param {number} userId - 用户 ID
 * @returns {Promise<boolean>} 是否成功（文件不存在也返回 true）
 */
async function deleteProjectConfig(userId) {
  const configPath = getConfigPath(userId);
  try {
    await fs.unlink(configPath);
    logger.info({ userId, path: configPath }, 'Deleted user project config');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true; // 文件不存在视为成功
    }
    throw error;
  }
}

export {
  loadProjectConfig,
  saveProjectConfig,
  deleteProjectConfig,
  getConfigPath,
  CONFIGS_DIR
};
