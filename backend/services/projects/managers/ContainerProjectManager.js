/**
 * 容器项目管理模块
 *
 * 提供容器内的项目管理功能，包括列出项目和创建默认工作区。
 * 支持从容器内读取会话信息。
 *
 * @module projects/managers/ContainerProjectManager
 */

import { PassThrough } from 'stream';
import containerManager from '../../container/core/index.js';
import { getSessionsInContainer } from '../../sessions/container/ContainerSessions.js';
import { CONTAINER, FILE_TIMEOUTS } from '../../../config/config.js';
import { RESERVED_DIR_NAMES } from '../../../config/containerConfig.js';
import { loadProjectConfig } from '../config/index.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/managers/ContainerProjectManager');

// ContainerProjectManager.js 功能函数
/**
 * 从 Docker 多路复用流中收集 stdout 输出
 * Docker exec 返回的流包含 8 字节帧头（streamType + length），
 * 必须通过 modem.demuxStream 解码后才能得到正确的文本内容。
 * @param {Object} stream - Docker exec 返回的原始流
 * @returns {Promise<string>} stdout 输出内容
 */
function _collectStreamOutput(stream) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  containerManager.docker.modem.demuxStream(stream, stdout, stderr);

  return new Promise((resolve) => {
    let data = '';
    stdout.on('data', (chunk) => { data += chunk.toString(); });
    stderr.on('data', () => {});
    stream.on('error', () => resolve(''));
    stream.on('end', () => resolve(data));
  });
}

// ContainerProjectManager.js 功能函数
/**
 * 创建项目条目对象
 * @param {string} projectName - 项目名称
 * @param {string} displayName - 显示名称
 * @returns {Object} 项目对象
 */
function createProjectEntry(projectName, displayName) {
  return {
    name: projectName,
    path: projectName.replace(/-/g, '/'),
    displayName: displayName || projectName,
    fullPath: projectName,
    isContainerProject: true,
    sessions: [],
    sessionMeta: { hasMore: false, total: 0 },
    cursorSessions: [],
    codexSessions: [],
  };
}

// ContainerProjectManager.js 功能函数
/**
 * 从 ls 输出解析项目列表
 * @param {string} output - 命令输出
 * @param {Object} projectConfig - 项目配置
 * @returns {Array} 项目列表
 */
function parseProjectList(output, projectConfig) {
  const projectList = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    let projectName = line.replace(/[\x00-\x1f\x7f]/g, '').trim();
    if (!projectName || projectName.startsWith('.')) continue;

    const customDisplayName = projectConfig[projectName]?.displayName;
    projectList.push(createProjectEntry(projectName, customDisplayName));
  }

  return projectList;
}

// ContainerProjectManager.js 功能函数
/**
 * 在容器内创建默认工作区
 * @param {number} userId - 用户 ID
 * @param {string} workspacePath - 工作空间路径
 * @returns {Object|null} 创建的项目条目，失败返回 null
 */
async function createDefaultWorkspace(userId, workspacePath) {
  logger.info('[ContainerProjectManager] No projects found, creating default workspace');
  try {
    const { stream: createStream } = await containerManager.execInContainer(
      userId,
      ['sh', '-c', 'mkdir -p "$1/my-workspace" && echo "created"', 'createDefault', workspacePath]
    );

    await _collectStreamOutput(createStream);

    logger.info('[ContainerProjectManager] Default workspace created: my-workspace');
    return createProjectEntry('my-workspace', 'my-workspace');
  } catch (error) {
    logger.warn({ err: error }, 'Failed to create default workspace');
    return null;
  }
}

// ContainerProjectManager.js 功能函数
/**
 * 加载项目列表的会话信息
 * @param {number} userId - 用户 ID
 * @param {Array} projectList - 项目列表
 */
async function loadProjectSessions(userId, projectList) {
  for (const project of projectList) {
    try {
      const sessionResult = await getSessionsInContainer(userId, project.name, 20, 0);
      project.sessions = sessionResult.sessions || [];
      project.sessionMeta = { hasMore: sessionResult.hasMore, total: sessionResult.total };
    } catch {
      project.sessions = [];
      project.sessionMeta = { hasMore: false, total: 0 };
    }
  }
}

// 由 GET /api/projects 调用，在 Docker 容器中执行 find 命令发现项目
/**
 * 从容器内获取项目列表
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} 项目列表
 */
export async function getProjectsInContainer(userId) {
  try {
    let container;
    try {
      container = await containerManager.getOrCreateContainer(userId, {}, { wait: true, timeout: FILE_TIMEOUTS.quickRequest });
    } catch (err) {
      logger.error(`[ContainerProjectManager] Failed to get/create container for user ${userId}: ${err.message}`);
      return [];
    }

    const workspacePath = CONTAINER.paths.workspace;
    logger.info(`[getProjectsInContainer] ① userId=${userId} workspacePath=${workspacePath} containerId=${container.id}`);

    // 动态构建排除列表，基于 RESERVED_DIR_NAMES 共享常量
    const excludePattern = RESERVED_DIR_NAMES
      .map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .map(d => `grep -v "^${d}$"`)
      .join(' | ');
    const lsCmd = `ls -1 "$1" 2>/dev/null | ${excludePattern} || echo ""`;

    const { stream } = await containerManager.execInContainer(
      userId,
      ['sh', '-c', lsCmd, 'listProjects', workspacePath]
    );

    const output = await _collectStreamOutput(stream);
    logger.info(`[getProjectsInContainer] ② ls 输出 (raw): ${JSON.stringify(output)}`);

    let projectConfig = {};
    try { projectConfig = await loadProjectConfig(); } catch {
      logger.debug('Failed to load project config, using defaults');
    }

    const projectList = parseProjectList(output, projectConfig);
    logger.info(`[getProjectsInContainer] ③ 解析后项目数=${projectList.length}, 名称列表: ${projectList.map(p => p.name).join(', ')}`);

    if (projectList.length === 0) {
      const defaultEntry = await createDefaultWorkspace(userId, workspacePath);
      if (defaultEntry) projectList.push(defaultEntry);
    }

    await loadProjectSessions(userId, projectList);
    logger.info(`[getProjectsInContainer] ④ 最终返回 ${projectList.length} 个项目`);
    return projectList;
  } catch (error) {
    throw new Error(`Failed to get projects in container: ${error.message}`);
  }
}
