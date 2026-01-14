/**
 * 项目管理操作（容器模式）
 *
 * 处理项目的增删改操作：
 * - 重命名项目显示名称
 * - 删除会话
 * - 删除空项目
 * - 手动添加项目
 *
 * @module projects/project-management/operations
 */

import { loadProjectConfig, saveProjectConfig } from '../config/index.js';
import { deleteSessionInContainer, getSessionsInContainer } from '../../sessions/container/ContainerSessions.js';
import containerManager from '../../container/core/index.js';
import { CONTAINER } from '../../../config/config.js';

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
 * 删除项目的某个会话（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteSession(userId, projectName, sessionId) {
  try {
    return await deleteSessionInContainer(userId, projectName, sessionId);
  } catch (error) {
    console.error(`Error deleting session ${sessionId} from project ${projectName}:`, error);
    throw error;
  }
}

/**
 * 检查项目是否为空（没有会话）（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @returns {Promise<boolean>} 项目是否为空
 */
async function isProjectEmpty(userId, projectName) {
  try {
    const sessionsResult = await getSessionsInContainer(userId, projectName, 1, 0);
    return sessionsResult.total === 0;
  } catch (error) {
    console.error(`Error checking if project ${projectName} is empty:`, error);
    return false;
  }
}

/**
 * 删除空项目（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteProject(userId, projectName) {
  console.log(`[deleteProject] Attempting to delete project "${projectName}" for user ${userId}`);

  try {
    // First check if the project is empty
    const isEmpty = await isProjectEmpty(userId, projectName);

    if (!isEmpty) {
      throw new Error('Cannot delete project with existing sessions');
    }

    // 删除容器内的项目目录
    const projectPath = `${CONTAINER.paths.workspace}/${projectName}`;

    const { stream } = await containerManager.execInContainer(
      userId,
      `rm -rf "${projectPath}"`
    );

    await new Promise((resolve, reject) => {
      stream.on('error', (err) => {
        console.error(`[deleteProject] Error removing directory:`, err);
        reject(err);
      });
      stream.on('end', () => {
        console.log(`[deleteProject] Project directory removed: ${projectPath}`);
        resolve();
      });
    });

    // Remove from project config
    const config = await loadProjectConfig();
    delete config[projectName];
    await saveProjectConfig(config);

    console.log(`[deleteProject] Project "${projectName}" deleted successfully`);
    return true;
  } catch (error) {
    console.error(`[deleteProject] Failed to delete project "${projectName}":`, error);
    throw error;
  }
}

/**
 * 手动添加项目到配置（容器模式）
 * 在容器模式下，项目存储在 /workspace 下
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string|null} displayName - 显示名称
 * @returns {Promise<Object>} 添加的项目信息
 */
async function addProjectManually(userId, projectName, displayName = null) {
  try {
    // 确保容器存在
    await containerManager.getOrCreateContainer(userId);

    // 在容器内创建项目目录
    const projectPath = `${CONTAINER.paths.workspace}/${projectName}`;

    const { stream } = await containerManager.execInContainer(
      userId,
      `mkdir -p "${projectPath}"`
    );

    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
    });

    // Add to config as manually added project
    const config = await loadProjectConfig();

    if (config[projectName]) {
      throw new Error(`Project already configured: ${projectName}`);
    }

    config[projectName] = {
      manuallyAdded: true
    };

    if (displayName) {
      config[projectName].displayName = displayName;
    }

    await saveProjectConfig(config);

    return {
      name: projectName,
      path: projectName,
      fullPath: projectName,
      displayName: displayName || projectName,
      isManuallyAdded: true,
      isContainerProject: true,
      sessions: []
    };
  } catch (error) {
    console.error(`Error adding project "${projectName}":`, error);
    throw error;
  }
}

export {
  renameProject,
  deleteSession,
  isProjectEmpty,
  deleteProject,
  addProjectManually
};
