import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/container/claude/SessionManager');

/**
 * 容器化 Claude SDK 会话管理器
 *
 * 负责跟踪和管理容器内运行的 Claude SDK 会话。
 */

// 容器化查询的会话跟踪
const containerSessions = new Map();

/**
 * 设置会话的 stream 对象
 * @param {string} sessionId - 会话 ID
 * @param {object} stream - Docker exec stream 对象
 */
export function setSessionStream(sessionId, stream) {
  const session = containerSessions.get(sessionId);
  if (session) {
    session.stream = stream;
  }
}

/**
 * 设置会话的 stdin 写入函数
 * @param {string} sessionId - 会话 ID
 * @param {Function} stdinWriter - 写入容器 stdin 的函数，接受 string 参数
 */
export function setSessionStdin(sessionId, stdinWriter) {
  const session = containerSessions.get(sessionId);
  if (session) {
    session.stdinWriter = stdinWriter;
  }
}

/**
 * 获取会话的 stdin 写入函数（带会话所有权校验）
 *
 * 仅当请求者的 userId 与会话创建者一致时才返回 stdinWriter，
 * 防止跨会话数据注入。
 *
 * @param {string} sessionId - 会话 ID
 * @param {number} userId - 请求者的用户 ID
 * @returns {Function|null} stdin 写入函数，或 null（会话不存在或不属于该用户）
 */
export function getSessionStdin(sessionId, userId) {
  const session = containerSessions.get(sessionId);
  if (!session) return null;
  // 校验会话所有权：确保只有创建该会话的用户可以写入 stdin
  if (userId !== undefined && session.userId !== undefined && session.userId !== userId) {
    logger.warn({ sessionId, requestedBy: userId, ownerBy: session.userId }, '[SessionManager] Session ownership mismatch');
    return null;
  }
  return session.stdinWriter || null;
}

/**
 * 为已有会话注册别名 session ID
 * 用于 session-created 场景：SDK 返回真实 session ID 后，
 * 以真实 ID 为 key 创建指向同一会话对象的引用，
 * 使前端用真实 ID 查找 stdin writer 时能找到。
 *
 * @param {string} aliasId - 别名 session ID（如 SDK 返回的真实 ID）
 * @param {string} originalId - 原始 session ID（如 temp-xxx）
 */
export function aliasSessionId(aliasId, originalId) {
  const session = containerSessions.get(originalId);
  if (session && aliasId !== originalId) {
    containerSessions.set(aliasId, session);
    logger.debug({ aliasId, originalId }, '[SessionManager] Created session alias');
  }
}

/**
 * 创建新会话
 * @param {string} sessionId - 会话 ID
 * @param {object} sessionInfo - 会话信息
 * @param {number} sessionInfo.userId - 用户 ID
 * @param {string} sessionInfo.containerId - 容器 ID
 * @param {string} sessionInfo.command - 用户原始命令
 * @param {object} sessionInfo.options - 其他选项
 */
export function createSession(sessionId, sessionInfo) {
  containerSessions.set(sessionId, {
    ...sessionInfo,
    startTime: Date.now(),
    status: 'running'
  });
}

/**
 * 更新会话状态
 * @param {string} sessionId - 会话 ID
 * @param {object} updates - 要更新的字段
 */
export function updateSession(sessionId, updates) {
  const session = containerSessions.get(sessionId);
  if (session) {
    Object.assign(session, updates);
  }
}

/**
 * 获取会话信息
 * @param {string} sessionId - 会话 ID
 * @returns {object|undefined} 会话信息
 */
export function getSession(sessionId) {
  return containerSessions.get(sessionId);
}

/**
 * 删除会话
 * @param {string} sessionId - 会话 ID
 */
export function deleteSession(sessionId) {
  containerSessions.delete(sessionId);
}

/**
 * 中止会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 如果会话已中止则返回 true
 */
export async function abortSession(sessionId) {
  const session = containerSessions.get(sessionId);

  if (!session) {
    return false;
  }

  session.status = 'aborted';
  session.endTime = Date.now();

  // 通过销毁 stream 来终止 Docker exec 进程
  if (session.stream) {
    try {
      // 调用 stream.destroy() 中断流，从而终止 exec 进程
      session.stream.destroy();
      logger.debug(`[SessionManager] Destroyed stream for session: ${sessionId}`);
    } catch (error) {
      logger.error({ err: error, sessionId }, 'Error destroying stream for session');
    }
  }

  containerSessions.delete(sessionId);

  return true;
}

/**
 * 检查会话是否活动
 * @param {string} sessionId - 会话 ID
 * @returns {boolean} 如果会话活动则返回 true
 */
export function isSessionActive(sessionId) {
  const session = containerSessions.get(sessionId);
  return session && session.status === 'running';
}

/**
 * 获取所有活动会话
 * @returns {Array} 活动会话信息数组
 */
export function getActiveSessions() {
  return Array.from(containerSessions.values())
    .filter(session => session.status === 'running');
}

