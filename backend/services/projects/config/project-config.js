/**
 * 项目配置管理
 *
 * 负责加载和保存项目配置文件（~/.claude/project-config.json）
 * 存储项目自定义显示名称、手动添加的项目等元数据
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.claude', 'project-config.json');
const CLAUDE_DIR = path.join(os.homedir(), '.claude');

/**
 * 加载项目配置文件
 * @returns {Promise<Object>} 项目配置对象
 */
async function loadProjectConfig() {
  try {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // Return empty config if file doesn't exist
    return {};
  }
}

/**
 * 保存项目配置文件
 * @param {Object} config - 项目配置对象
 * @returns {Promise<void>}
 */
async function saveProjectConfig(config) {
  // Ensure the .claude directory exists
  try {
    await fs.mkdir(CLAUDE_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export {
  loadProjectConfig,
  saveProjectConfig,
  CONFIG_PATH,
  CLAUDE_DIR
};
