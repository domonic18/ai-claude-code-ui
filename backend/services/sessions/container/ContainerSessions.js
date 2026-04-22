/**
 * 容器会话读取模块（门面）
 *
 * 从 Docker 容器内读取 Claude Code 会话信息。
 * 项目现在完全基于容器化架构运行。
 *
 * 本文件作为统一入口，将具体实现委托给子模块：
 * - containerPathEncoder — 路径编解码
 * - containerFileReader — Docker exec 文件操作
 * - sessionParser — JSONL 解析与会话数据提取
 * - sessionReader — 会话数据读取
 *
 * Session 存储位置：/workspace/.claude/projects/{projectName}/
 * 项目名称编码：my-workspace → -workspace-my-workspace
 *
 * @module sessions/container/ContainerSessions
 */

import { createLogger } from '../../../utils/logger.js';
import { filterMemoryContextFromEntry } from '../../core/utils/jsonl-parser.js';
import { buildSessionGroups, addToSessionGroup, mergeGroupedAndStandalone } from './sessionGrouping.js';
import { updateSessionSummaryInContainer, deleteSessionInContainer } from './sessionWriter.js';
import {
  forEachSessionFile,
  listSessionFiles,
  getProjectDir,
  collectAllSessionData,
  collectMessagesForSession,
  getSessionFilesInfo
} from './sessionReader.js';

const logger = createLogger('services/sessions/container/ContainerSessions');

// ─── 从子模块重导出 ─────────────────────────────────────

export { encodeProjectName } from './containerPathEncoder.js';
export { readFileFromContainer } from './containerFileReader.js';
export { parseJsonlContent } from '../../core/utils/jsonl-parser.js';
export { listSessionFiles, getProjectDir } from './sessionReader.js';

// ─── 公共 JSONL 工具函数 ────────────────────────────────

// 在返回会话列表前调用，根据 limit 和 offset 参数对数组进行分页
// ContainerSessions.js 功能函数
/**
 * 分页辅助函数
 * @param {Array} items - 要分页的数组
 * @param {number} limit - 每页数量
 * @param {number} offset - 偏移量
 * @returns {Object} 包含分页数据和元数据的对象
 */
function _paginate(items, limit, offset) {
  const total = items.length;
  const paginatedItems = items.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return {
    items: paginatedItems,
    total,
    hasMore,
    offset,
    limit
  };
}

// ContainerSessions.js 功能函数
/**
 * 获取项目的会话列表（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {number} limit - 返回的会话数量限制
 * @param {number} offset - 分页偏移量
 * @returns {Promise<Object>} 会话列表和分页信息
 */
async function getSessionsInContainer(userId, projectName, limit = 5, offset = 0) {
  try {
    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      return { sessions: [], hasMore: false, total: 0 };
    }

    const projectDir = getProjectDir(projectName);
    const { allSessions, allEntries } = await collectAllSessionData(userId, projectDir, sessionFiles);

    const sessionGroups = buildSessionGroups(allEntries, allSessions);
    const visibleSessions = mergeGroupedAndStandalone(sessionGroups, allSessions);

    const pagination = _paginate(visibleSessions, limit, offset);

    return {
      sessions: pagination.items,
      hasMore: pagination.hasMore,
      total: pagination.total,
      offset: pagination.offset,
      limit: pagination.limit
    };

  } catch (error) {
    logger.error(`[ContainerSessions] Error getting sessions for project ${projectName}:`, error);
    return { sessions: [], hasMore: false, total: 0 };
  }
}

// ContainerSessions.js 功能函数
/**
 * 排序和过滤消息
 * @param {Array} messages - 原始消息数组
 * @returns {Array} 排序并过滤后的消息数组
 */
function _sortAndFilterMessages(messages) {
  // 按时间戳排序
  messages.sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  // 过滤所有用户消息中的记忆上下文
  return messages.map(filterMemoryContextFromEntry);
}

// ContainerSessions.js 功能函数
/**
 * 从容器内获取特定会话的消息（支持分页）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @param {number|null} limit - 消息数量限制（null 表示返回全部）
 * @param {number} offset - 分页偏移量
 * @returns {Promise<Object|Array>} 消息列表和分页信息，或全部消息
 */
async function getSessionMessagesInContainer(userId, projectName, sessionId, limit = null, offset = 0) {
  try {
    const projectDir = getProjectDir(projectName);
    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      return { messages: [], total: 0, hasMore: false };
    }

    const messages = await collectMessagesForSession(userId, projectDir, sessionFiles, sessionId);
    const filteredMessages = _sortAndFilterMessages(messages);

    // 处理分页
    if (limit === null) {
      // 返回全部消息（向后兼容）
      return filteredMessages;
    } else {
      // 返回分页消息
      const pagination = _paginate(filteredMessages, limit, offset);
      return {
        messages: pagination.items,
        total: pagination.total,
        hasMore: pagination.hasMore,
        offset: pagination.offset,
        limit: pagination.limit
      };
    }
  } catch (error) {
    logger.error({ err: error, projectName, sessionId, userId }, `[ContainerSessions] Error getting session messages`);
    return { messages: [], total: 0, hasMore: false };
  }
}

// ─── 会话写操作 ──────────────────────────────────────────

// ContainerSessions.js 功能函数
/**
 * 更新会话摘要（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @param {string} newSummary - 新的摘要
 * @returns {Promise<boolean>} 是否成功
 */
async function updateSessionSummaryInContainerWrapped(userId, projectName, sessionId, newSummary) {
  const projectDir = getProjectDir(projectName);
  return await updateSessionSummaryInContainer(userId, projectName, sessionId, newSummary, listSessionFiles, async (userId, projectName, sessionFiles, handler) => {
    await forEachSessionFile(userId, projectDir, sessionFiles, handler);
  });
}

// 在容器中删除会话
/**
 * 删除会话（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteSessionInContainerWrapped(userId, projectName, sessionId) {
  const projectDir = getProjectDir(projectName);
  return await deleteSessionInContainer(userId, projectName, sessionId, listSessionFiles, async (userId, projectName, sessionFiles, handler) => {
    await forEachSessionFile(userId, projectDir, sessionFiles, handler);
  });
}

export {
  getSessionsInContainer,
  getSessionMessagesInContainer,
  updateSessionSummaryInContainerWrapped as updateSessionSummaryInContainer,
  deleteSessionInContainerWrapped as deleteSessionInContainer
};
