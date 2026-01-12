/**
 * 项目管理操作
 *
 * 处理项目的增删改操作：
 * - 重命名项目显示名称
 * - 删除会话
 * - 删除空项目
 * - 手动添加项目
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { loadProjectConfig, saveProjectConfig } from '../config/index.js';
import { generateDisplayName } from '../utils/index.js';
import { getSessions } from '../claude/index.js';

/**
 * 重命名项目的显示名称
 * @param {string} projectName - 项目名称
 * @param {string} newDisplayName - 新的显示名称
 * @returns {Promise<boolean>} 是否成功
 */
async function renameProject(projectName, newDisplayName) {
  const config = await loadProjectConfig();

  if (!newDisplayName || newDisplayName.trim() === '') {
    // Remove custom name if empty, will fall back to auto-generated
    delete config[projectName];
  } else {
    // Set custom display name
    config[projectName] = {
      displayName: newDisplayName.trim()
    };
  }

  await saveProjectConfig(config);
  return true;
}

/**
 * 删除项目的某个会话
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteSession(projectName, sessionId) {
  const projectDir = path.join(os.homedir(), '.claude', 'projects', projectName);

  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) {
      throw new Error('No session files found for this project');
    }

    // Check all JSONL files to find which one contains the session
    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file);
      const content = await fs.readFile(jsonlFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      // Check if this file contains the session
      const hasSession = lines.some(line => {
        try {
          const data = JSON.parse(line);
          return data.sessionId === sessionId;
        } catch {
          return false;
        }
      });

      if (hasSession) {
        // Filter out all entries for this session
        const filteredLines = lines.filter(line => {
          try {
            const data = JSON.parse(line);
            return data.sessionId !== sessionId;
          } catch {
            return true; // Keep malformed lines
          }
        });

        // Write back the filtered content
        await fs.writeFile(jsonlFile, filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : ''));
        return true;
      }
    }

    throw new Error(`Session ${sessionId} not found in any files`);
  } catch (error) {
    console.error(`Error deleting session ${sessionId} from project ${projectName}:`, error);
    throw error;
  }
}

/**
 * 检查项目是否为空（没有会话）
 * @param {string} projectName - 项目名称
 * @returns {Promise<boolean>} 项目是否为空
 */
async function isProjectEmpty(projectName) {
  try {
    const sessionsResult = await getSessions(projectName, 1, 0);
    return sessionsResult.total === 0;
  } catch (error) {
    console.error(`Error checking if project ${projectName} is empty:`, error);
    return false;
  }
}

/**
 * 删除空项目
 * @param {string} projectName - 项目名称
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteProject(projectName) {
  const projectDir = path.join(os.homedir(), '.claude', 'projects', projectName);

  try {
    // First check if the project is empty
    const isEmpty = await isProjectEmpty(projectName);
    if (!isEmpty) {
      throw new Error('Cannot delete project with existing sessions');
    }

    // Remove the project directory
    await fs.rm(projectDir, { recursive: true, force: true });

    // Remove from project config
    const config = await loadProjectConfig();
    delete config[projectName];
    await saveProjectConfig(config);

    return true;
  } catch (error) {
    console.error(`Error deleting project ${projectName}:`, error);
    throw error;
  }
}

/**
 * 手动添加项目到配置（不创建文件夹）
 * @param {string} projectPath - 项目路径
 * @param {string|null} displayName - 显示名称
 * @returns {Promise<Object>} 添加的项目信息
 */
async function addProjectManually(projectPath, displayName = null) {
  const absolutePath = path.resolve(projectPath);

  try {
    // Check if the path exists
    await fs.access(absolutePath);
  } catch (error) {
    throw new Error(`Path does not exist: ${absolutePath}`);
  }

  // Generate project name (encode path for use as directory name)
  const projectName = absolutePath.replace(/\//g, '-');

  // Check if project already exists in config
  const config = await loadProjectConfig();
  const projectDir = path.join(os.homedir(), '.claude', 'projects', projectName);

  if (config[projectName]) {
    throw new Error(`Project already configured for path: ${absolutePath}`);
  }

  // Allow adding projects even if the directory exists - this enables tracking
  // existing Claude Code or Cursor projects in the UI

  // Add to config as manually added project
  config[projectName] = {
    manuallyAdded: true,
    originalPath: absolutePath
  };

  if (displayName) {
    config[projectName].displayName = displayName;
  }

  await saveProjectConfig(config);


  return {
    name: projectName,
    path: absolutePath,
    fullPath: absolutePath,
    displayName: displayName || await generateDisplayName(projectName, absolutePath),
    isManuallyAdded: true,
    sessions: [],
    cursorSessions: []
  };
}

export {
  renameProject,
  deleteSession,
  isProjectEmpty,
  deleteProject,
  addProjectManually
};
