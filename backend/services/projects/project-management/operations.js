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
import { getProjectDir } from '../../sessions/container/sessionReader.js';
import containerManager from '../../container/core/index.js';
import { CONTAINER } from '../../../config/config.js';
import { readStreamOutput } from '../../files/utils/file-utils.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/project-management/operations');

// 由 PUT /api/projects/:id/rename 调用，更新项目显示名称
/**
 * 重命名项目的显示名称
 * @param {number} userId - 用户 ID（配置按用户隔离）
 * @param {string} projectName - 项目名称
 * @param {string} newDisplayName - 新的显示名称
 * @returns {Promise<boolean>} 是否成功
 */
async function renameProject(userId, projectName, newDisplayName) {
  const config = await loadProjectConfig(userId);

  if (!newDisplayName || newDisplayName.trim() === '') {
    // Remove custom name if empty, will fall back to auto-generated
    delete config[projectName];
  } else {
    // Set custom display name
    config[projectName] = {
      displayName: newDisplayName.trim()
    };
  }

  await saveProjectConfig(userId, config);
  return true;
}

// 由 DELETE /api/projects/:id/sessions/:sessionId 调用，删除指定会话
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
    logger.error(`Error deleting session ${sessionId} from project ${projectName}:`, error);
    throw error;
  }
}

// 由 DELETE /api/projects/:id 调用，检查项目是否包含会话
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
    logger.error(`Error checking if project ${projectName} is empty:`, error);
    return false;
  }
}

// 由 DELETE /api/projects/:id 调用，删除项目及所有会话
/**
 * 删除项目（容器模式）
 *
 * 同时清理两类持久化数据，否则删除不完整、重建同名项目时会"复活"：
 * 1. 项目代码目录 /workspace/{projectName}
 * 2. 会话历史目录 /workspace/.claude/projects/{encodeProjectName(projectName)}/
 *    （会话与项目代码分离存储，且都在用户命名卷里持久化；
 *     不清理这里会导致删后重建同名项目时旧会话被读回）
 *
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteProject(userId, projectName) {
  logger.info(`[deleteProject] Attempting to delete project "${projectName}" for user ${userId}`);

  try {
    const projectPath = `${CONTAINER.paths.workspace}/${projectName}`;
    // 会话历史目录（与项目代码目录分离存储，必须一并清理）
    const sessionPath = getProjectDir(projectName);

    // 用一条 sh -c 同时删除项目目录和会话目录，减少容器往返
    // 安全性来自位置参数：projectPath/sessionPath 作为 $1/$2 传入，命令里用 "$1" "$2"
    // 引用，是字面量 argv，不会被 shell 重新解析，故含特殊字符也无注入。
    // 注意 projectName 本身并未转义——切勿把此行改成 rm -rf "${projectPath}" 之类的字符串插值，
    // 那会引入真实的命令注入。
    const { stream } = await containerManager.execInContainer(
      userId,
      ['sh', '-c', 'rm -rf "$1" "$2"', 'deleteProject', projectPath, sessionPath]
    );
    await readStreamOutput(stream, { timeout: 10000 });

    logger.info(`[deleteProject] Removed project dir "${projectPath}" and session dir "${sessionPath}"`);

    const config = await loadProjectConfig(userId);
    delete config[projectName];
    await saveProjectConfig(userId, config);

    logger.info(`[deleteProject] Project "${projectName}" deleted successfully`);
    return true;
  } catch (error) {
    logger.error(`[deleteProject] Failed to delete project "${projectName}":`, error);
    throw error;
  }
}

// 由 POST /api/projects/manual 调用，手动添加自定义项目
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
    // 确保容器存在并 ready（关键：使用 wait: true 确保容器准备好接受命令）
    const container = await containerManager.getOrCreateContainer(
      userId,
      {},
      { wait: true, timeout: 30000 }
    );
    logger.info(`[addProjectManually] Container ready: ${container.id} for user ${userId}`);

    // 在容器内创建项目目录
    const projectPath = `${CONTAINER.paths.workspace}/${projectName}`;

    const { stream } = await containerManager.execInContainer(
      userId,
      ['mkdir', '-p', projectPath]
    );

    // 读取输出并等待命令完成
    await readStreamOutput(stream, { timeout: 10000 });

    // 验证目录是否真的创建了（兼容 BusyBox 的 test）
    const { stream: verifyStream } = await containerManager.execInContainer(
      userId,
      ['sh', '-c', `[ -d "${projectPath}" ] && echo "EXISTS" || echo "MISSING"`]
    );
    const verifyOutput = await readStreamOutput(verifyStream, { timeout: 5000 });

    if (!verifyOutput.includes('EXISTS')) {
      throw new Error(`Failed to create project directory: ${projectPath}`);
    }

    logger.info(`[addProjectManually] Directory verified: ${projectPath}`);

    // Add to config as manually added project
    const config = await loadProjectConfig(userId);

    if (config[projectName]) {
      throw new Error(`Project already configured: ${projectName}`);
    }

    config[projectName] = {
      manuallyAdded: true
    };

    if (displayName) {
      config[projectName].displayName = displayName;
    }

    await saveProjectConfig(userId, config);
    logger.info(`[addProjectManually] Config saved for project: ${projectName}`);

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
    logger.error(`Error adding project "${projectName}":`, error);
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
