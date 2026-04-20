/**
 * 会话写操作模块
 *
 * 负责在容器内更新会话摘要和删除会话。
 *
 * @module sessions/container/sessionWriter
 */

import { writeJsonlContentToContainer } from './containerFileReader.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/sessions/container/sessionWriter');

/**
 * 查找并修改会话条目的通用模式
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @param {function} listSessionFiles - 列出会话文件的函数
 * @param {function} forEachSessionFile - 遍历会话文件的函数
 * @param {function} modifierFn - 修改函数
 * @returns {Promise<boolean>} 是否找到并修改了会话
 */
export async function _findAndModifySession(userId, projectName, sessionId, listSessionFiles, forEachSessionFile, modifierFn) {
  const sessionFiles = await listSessionFiles(userId, projectName);

  if (sessionFiles.length === 0) {
    return false;
  }

  let found = false;

  await forEachSessionFile(userId, projectName, sessionFiles, async ({ filePath, entries }) => {
    const result = modifierFn(entries);

    if (result.modified) {
      await writeJsonlContentToContainer(userId, filePath, result.entries);
      found = true;
      return true; // 提前终止遍历
    }
  });

  return found;
}

/**
 * 更新会话摘要（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @param {string} newSummary - 新的摘要
 * @param {function} listSessionFiles - 列出会话文件的函数
 * @param {function} forEachSessionFile - 遍历会话文件的函数
 * @returns {Promise<boolean>} 是否成功
 */
export async function updateSessionSummaryInContainer(userId, projectName, sessionId, newSummary, listSessionFiles, forEachSessionFile) {
  try {
    const found = await _findAndModifySession(userId, projectName, sessionId, listSessionFiles, forEachSessionFile, (entries) => {
      let sessionFound = false;
      let summaryEntryIndex = -1;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry._raw) continue;

        if (entry.sessionId === sessionId) {
          sessionFound = true;
          if (entry.type === 'summary') {
            summaryEntryIndex = i;
            entries[i] = {
              ...entry,
              summary: newSummary,
              timestamp: entry.timestamp || new Date().toISOString()
            };
          }
        }
      }

      if (sessionFound) {
        if (summaryEntryIndex === -1) {
          entries.push({
            type: 'summary',
            sessionId: sessionId,
            summary: newSummary,
            timestamp: new Date().toISOString()
          });
        }
        return { modified: true, entries };
      }

      return { modified: false, entries };
    });

    if (!found) {
      logger.warn(`[ContainerSessions] Session ${sessionId} not found`);
    }
    return found;
  } catch (error) {
    logger.error(`[ContainerSessions] Error updating session summary:`, error);
    return false;
  }
}

/**
 * 删除会话（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @param {function} listSessionFiles - 列出会话文件的函数
 * @param {function} forEachSessionFile - 遍历会话文件的函数
 * @returns {Promise<boolean>} 是否成功
 */
export async function deleteSessionInContainer(userId, projectName, sessionId, listSessionFiles, forEachSessionFile) {
  try {
    const found = await _findAndModifySession(userId, projectName, sessionId, listSessionFiles, forEachSessionFile, (entries) => {
      let sessionFound = false;

      // 过滤掉属于该会话的条目（从后向前遍历以安全删除）
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (!entry._raw && entry.sessionId === sessionId) {
          entries.splice(i, 1);
          sessionFound = true;
        }
      }

      return { modified: sessionFound, entries };
    });

    if (!found) {
      logger.warn(`[ContainerSessions] Session ${sessionId} not found`);
    }
    return found;
  } catch (error) {
    logger.error(`[ContainerSessions] Error deleting session:`, error);
    return false;
  }
}
