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
 *
 * Session 存储位置：/workspace/.claude/projects/{projectName}/
 * 项目名称编码：my-workspace → -workspace-my-workspace
 *
 * @module sessions/container/ContainerSessions
 */

import { CONTAINER } from '../../../config/config.js';
import { createLogger } from '../../../utils/logger.js';
import { encodeProjectName } from './containerPathEncoder.js';
import { readFileFromContainer, writeJsonlContentToContainer, execAndCollectOutput } from './containerFileReader.js';
import { parseJsonlContent, filterMemoryContextFromEntry } from '../../core/utils/jsonl-parser.js';

const logger = createLogger('services/sessions/container/ContainerSessions');

// ─── 从子模块重导出 ─────────────────────────────────────

export { encodeProjectName } from './containerPathEncoder.js';
export { readFileFromContainer } from './containerFileReader.js';
export { parseJsonlContent } from '../../core/utils/jsonl-parser.js';

// ─── 公共 JSONL 工具函数 ────────────────────────────────

/**
 * 将 JSONL 文本内容解析为条目数组
 * 格式错误的行保留为 { _raw: line } 以防丢失原始数据。
 * @param {string} content - JSONL 文件内容
 * @returns {Array<Object>} 解析后的条目数组
 */
function parseJsonlLines(content) {
  const lines = content.split('\n');
  const entries = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // 保留无法解析的行
      entries.push({ _raw: line });
    }
  }

  return entries;
}

/**
 * 遍历项目的所有会话文件，对每个文件执行 handler。
 * handler 返回 true 时提前终止遍历（用于 "找到就停" 的场景）。
 * @param {number} userId - 用户 ID
 * @param {string} projectDir - 容器内项目目录路径
 * @param {string[]} sessionFiles - 会话文件名列表
 * @param {function({filePath: string, entries: Object[]}): boolean|null} handler - 文件处理器
 * @returns {Promise<void>}
 */
async function forEachSessionFile(userId, projectDir, sessionFiles, handler) {
  for (const fileName of sessionFiles) {
    try {
      const filePath = `${projectDir}/${fileName}`;
      const content = await readFileFromContainer(userId, filePath);
      const entries = parseJsonlLines(content);

      const shouldStop = await handler({ filePath, entries });
      if (shouldStop) return;
    } catch (error) {
      logger.warn(`[ContainerSessions] Failed to process session file ${fileName}:`, error.message);
    }
  }
}

// ─── 会话文件操作 ────────────────────────────────────────

/**
 * 从容器内列出项目的会话文件
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @returns {Promise<Array>} 会话文件列表
 */
async function listSessionFiles(userId, projectName) {
  const encodedProjectName = encodeProjectName(projectName);
  const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

  const output = await execAndCollectOutput(
    userId,
    ['sh', '-c', 'for f in "$1"/*.jsonl; do [ -f "$f" ] && basename "$f"; done 2>/dev/null || echo ""', 'listJsonl', projectDir],
    { silentStderr: true }
  );

  try {
    const files = output.trim().split('\n').filter(f => f.trim());
    // 过滤掉 agent-*.jsonl 文件
    return files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));
  } catch (e) {
    return [];
  }
}

/**
 * 获取容器内项目目录的完整路径
 * @param {string} projectName - 项目名称
 * @returns {string} 容器内项目目录路径
 */
function getProjectDir(projectName) {
  const encodedProjectName = encodeProjectName(projectName);
  return `${CONTAINER.paths.projects}/${encodedProjectName}`;
}

// ─── 会话分组辅助函数 ────────────────────────────────────

/**
 * 根据条目和会话数据构建会话分组
 * 同一个 firstUserMsgId 关联的会话会被合并为一组
 * @param {Array} allEntries - 所有解析后的条目
 * @param {Map} allSessions - 所有会话 Map
 * @returns {Map} firstUserMsgId → { latestSession, allSessions }
 */
function buildSessionGroups(allEntries, allSessions) {
  const sessionGroups = new Map();
  const sessionToFirstUserMsgId = new Map();

  allEntries.forEach(entry => {
    if (entry.sessionId && entry.type === 'user' && entry.parentUuid === null && entry.uuid) {
      const firstUserMsgId = entry.uuid;

      if (!sessionToFirstUserMsgId.has(entry.sessionId)) {
        sessionToFirstUserMsgId.set(entry.sessionId, firstUserMsgId);

        const session = allSessions.get(entry.sessionId);
        if (session) {
          if (!sessionGroups.has(firstUserMsgId)) {
            sessionGroups.set(firstUserMsgId, {
              latestSession: session,
              allSessions: [session]
            });
          } else {
            const group = sessionGroups.get(firstUserMsgId);
            group.allSessions.push(session);

            if (new Date(session.lastActivity) > new Date(group.latestSession.lastActivity)) {
              group.latestSession = session;
            }
          }
        }
      }
    }
  });

  return sessionGroups;
}

/**
 * 合并分组会话和独立会话，返回排序后的完整列表
 * @param {Map} sessionGroups - firstUserMsgId → { latestSession, allSessions }
 * @param {Map} allSessions - 所有会话 Map
 * @returns {Array} 排序后的会话列表
 */
function mergeGroupedAndStandalone(sessionGroups, allSessions) {
  const groupedSessionIds = new Set();
  sessionGroups.forEach(group => {
    group.allSessions.forEach(session => groupedSessionIds.add(session.id));
  });

  const standaloneSessions = Array.from(allSessions.values())
    .filter(session => !groupedSessionIds.has(session.id));

  const latestFromGroups = Array.from(sessionGroups.values()).map(group => {
    const session = { ...group.latestSession };
    if (group.allSessions.length > 1) {
      session.isGrouped = true;
      session.groupSize = group.allSessions.length;
      session.groupSessions = group.allSessions.map(s => s.id);
    }
    return session;
  });

  return [...latestFromGroups, ...standaloneSessions]
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
}

// ─── 会话查询 ────────────────────────────────────────────

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

    const allSessions = new Map();
    const allEntries = [];
    const projectDir = getProjectDir(projectName);

    await forEachSessionFile(userId, projectDir, sessionFiles, ({ entries }) => {
      const result = parseJsonlContent(
        entries.map(e => e._raw || JSON.stringify(e)).filter(l => l.trim()).join('\n')
      );

      result.sessions.forEach(session => {
        if (!allSessions.has(session.id)) {
          allSessions.set(session.id, session);
        }
      });

      allEntries.push(...result.entries);
    });

    const sessionGroups = buildSessionGroups(allEntries, allSessions);
    const visibleSessions = mergeGroupedAndStandalone(sessionGroups, allSessions);

    const total = visibleSessions.length;
    const paginatedSessions = visibleSessions.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      sessions: paginatedSessions,
      hasMore,
      total,
      offset,
      limit
    };

  } catch (error) {
    logger.error(`[ContainerSessions] Error getting sessions for project ${projectName}:`, error);
    return { sessions: [], hasMore: false, total: 0 };
  }
}

/**
 * 获取项目的所有会话文件（用于调试）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @returns {Promise<Array>} 会话文件信息列表
 */
async function getSessionFilesInfo(userId, projectName) {
  try {
    const projectDir = getProjectDir(projectName);

    const output = await execAndCollectOutput(
      userId,
      ['sh', '-c', 'ls -la "$1" 2>/dev/null || echo "Directory not found"', 'lsDir', projectDir],
      { logLabel: 'ContainerSessions' }
    );

    return output;
  } catch (error) {
    logger.error(`[ContainerSessions] Error getting session files info:`, error);
    return '';
  }
}

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

    const messages = [];

    await forEachSessionFile(userId, projectDir, sessionFiles, ({ entries }) => {
      for (const entry of entries) {
        if (entry.sessionId === sessionId && !entry._raw) {
          messages.push(entry);
        }
      }
    });

    // 按时间戳排序
    messages.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });

    // 过滤所有用户消息中的记忆上下文
    const filteredMessages = messages.map(filterMemoryContextFromEntry);

    // 处理分页
    const total = filteredMessages.length;
    const hasMore = limit !== null && offset + limit < total;

    if (limit === null) {
      // 返回全部消息（向后兼容）
      return filteredMessages;
    } else {
      // 返回分页消息
      const paginatedMessages = filteredMessages.slice(offset, offset + limit);
      return {
        messages: paginatedMessages,
        total,
        hasMore,
        offset,
        limit
      };
    }
  } catch (error) {
    logger.error(`[ContainerSessions] Error getting session messages:`, error);
    return { messages: [], total: 0, hasMore: false };
  }
}

// ─── 会话写操作 ──────────────────────────────────────────

/**
 * 更新会话摘要（容器模式）
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @param {string} newSummary - 新的摘要
 * @returns {Promise<boolean>} 是否成功
 */
async function updateSessionSummaryInContainer(userId, projectName, sessionId, newSummary) {
  try {
    const projectDir = getProjectDir(projectName);
    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      return false;
    }

    // 在所有会话文件中查找该会话
    let found = false;

    await forEachSessionFile(userId, projectDir, sessionFiles, async ({ filePath, entries }) => {
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

        // Write back to file
        await writeJsonlContentToContainer(userId, filePath, entries);

        found = true;
        return true; // 提前终止遍历
      }
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
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteSessionInContainer(userId, projectName, sessionId) {
  try {
    const projectDir = getProjectDir(projectName);
    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      return false;
    }

    // 在所有会话文件中查找并删除该会话的条目
    let found = false;

    await forEachSessionFile(userId, projectDir, sessionFiles, async ({ filePath, entries }) => {
      let sessionFound = false;

      // 过滤掉属于该会话的条目
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (!entry._raw && entry.sessionId === sessionId) {
          entries.splice(i, 1);
          sessionFound = true;
        }
      }

      if (sessionFound) {
        // Write back to file
        await writeJsonlContentToContainer(userId, filePath, entries);

        found = true;
        return true; // 提前终止遍历
      }
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

export {
  getSessionsInContainer,
  getSessionFilesInfo,
  getSessionMessagesInContainer,
  updateSessionSummaryInContainer,
  deleteSessionInContainer
};
