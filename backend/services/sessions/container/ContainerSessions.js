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
import { parseJsonlContent, filterMemoryContextFromEntry } from './sessionParser.js';

const logger = createLogger('services/sessions/container/ContainerSessions');

// ─── 从子模块重导出 ─────────────────────────────────────

export { encodeProjectName } from './containerPathEncoder.js';
export { readFileFromContainer } from './containerFileReader.js';
export { parseJsonlContent } from './sessionParser.js';

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

    // 读取所有会话文件
    const allSessions = new Map();
    const allEntries = [];

    for (const fileName of sessionFiles) {
      try {
        const encodedProjectName = encodeProjectName(projectName);
        const filePath = `${CONTAINER.paths.projects}/${encodedProjectName}/${fileName}`;
        const content = await readFileFromContainer(userId, filePath);

        const result = parseJsonlContent(content);

        result.sessions.forEach(session => {
          if (!allSessions.has(session.id)) {
            allSessions.set(session.id, session);
          }
        });

        allEntries.push(...result.entries);
      } catch (error) {
        logger.warn(`[ContainerSessions] Failed to read session file ${fileName}:`, error.message);
      }
    }

    // 构建会话分组（与主机模式相同逻辑）
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

    // 收集独立会话
    const groupedSessionIds = new Set();
    sessionGroups.forEach(group => {
      group.allSessions.forEach(session => groupedSessionIds.add(session.id));
    });

    const standaloneSessions = Array.from(allSessions.values())
      .filter(session => !groupedSessionIds.has(session.id));

    // 合并分组会话和独立会话
    const latestFromGroups = Array.from(sessionGroups.values()).map(group => {
      const session = { ...group.latestSession };
      if (group.allSessions.length > 1) {
        session.isGrouped = true;
        session.groupSize = group.allSessions.length;
        session.groupSessions = group.allSessions.map(s => s.id);
      }
      return session;
    });

    const visibleSessions = [...latestFromGroups, ...standaloneSessions]
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

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
    const encodedProjectName = encodeProjectName(projectName);
    const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

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
    const encodedProjectName = encodeProjectName(projectName);
    const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      return { messages: [], total: 0, hasMore: false };
    }

    const messages = [];

    // 读取所有会话文件以查找该 session 的消息
    for (const fileName of sessionFiles) {
      try {
        const filePath = `${projectDir}/${fileName}`;
        const content = await readFileFromContainer(userId, filePath);

        // 解析 JSONL 内容
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const entry = JSON.parse(line);
              if (entry.sessionId === sessionId) {
                messages.push(entry);
              }
            } catch (parseError) {
              // 跳过格式错误的行
            }
          }
        }
      } catch (error) {
        logger.warn(`[ContainerSessions] Failed to read session file ${fileName}:`, error.message);
      }
    }

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
    const encodedProjectName = encodeProjectName(projectName);
    const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      return false;
    }

    // 在所有会话文件中查找该会话
    for (const fileName of sessionFiles) {
      try {
        const filePath = `${projectDir}/${fileName}`;
        const content = await readFileFromContainer(userId, filePath);

        // 解析 JSONL 内容
        const lines = content.split('\n');
        const entries = [];
        let sessionFound = false;
        let summaryEntryIndex = -1;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const entry = JSON.parse(line);
              entries.push(entry);

              if (entry.sessionId === sessionId) {
                sessionFound = true;
                // 查找或更新 summary 条目
                if (entry.type === 'summary') {
                  summaryEntryIndex = entries.length - 1;
                  entries[entries.length - 1] = {
                    ...entry,
                    summary: newSummary,
                    timestamp: entry.timestamp || new Date().toISOString()
                  };
                }
              }
            } catch (parseError) {
              // 保留无法解析的行
              entries.push({ _raw: line });
            }
          }
        }

        if (sessionFound) {
          // If no summary entry exists, add a new one
          if (summaryEntryIndex === -1) {
            entries.push({
              type: 'summary',
              sessionId: sessionId,
              summary: newSummary,
              timestamp: new Date().toISOString()
            });
          }

          // Write back to file using shared function
          await writeJsonlContentToContainer(userId, filePath, entries);

          return true;
        }
      } catch (error) {
        logger.warn(`[ContainerSessions] Failed to process session file ${fileName}:`, error.message);
      }
    }

    logger.warn(`[ContainerSessions] Session ${sessionId} not found`);
    return false;
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
    const encodedProjectName = encodeProjectName(projectName);
    const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

    const sessionFiles = await listSessionFiles(userId, projectName);

    if (sessionFiles.length === 0) {
      return false;
    }

    // 在所有会话文件中查找并删除该会话的条目
    for (const fileName of sessionFiles) {
      try {
        const filePath = `${projectDir}/${fileName}`;
        const content = await readFileFromContainer(userId, filePath);

        // 解析 JSONL 内容
        const lines = content.split('\n');
        const entries = [];
        let sessionFound = false;

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            try {
              const entry = JSON.parse(line);
              // 只保留不属于该会话的条目
              if (entry.sessionId !== sessionId) {
                entries.push(entry);
              } else {
                sessionFound = true;
              }
            } catch (parseError) {
              // 保留无法解析的行
              entries.push({ _raw: line });
            }
          }
        }

        if (sessionFound) {
          // Write back to file using shared function
          await writeJsonlContentToContainer(userId, filePath, entries);

          return true;
        }
      } catch (error) {
        logger.warn(`[ContainerSessions] Failed to process session file ${fileName}:`, error.message);
      }
    }

    logger.warn(`[ContainerSessions] Session ${sessionId} not found`);
    return false;
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
