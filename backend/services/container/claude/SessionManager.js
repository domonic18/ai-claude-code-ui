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
 * 设置会话的进程 kill 函数
 * abort 时调用，用于终止容器内 SDK 进程。
 * 背景：容器非 TTY 模式下 destroy stream 只断 attach 连接、不发信号给容器内进程，
 * 必须显式 kill，否则容器内 SDK 会继续执行后续 todo 直到任务自然完成（停止按钮失效）。
 * @param {string} sessionId - 会话 ID
 * @param {Function} killFn - 异步 kill 函数，终止容器内 SDK 进程
 */
export function setSessionKillFn(sessionId, killFn) {
  const session = containerSessions.get(sessionId);
  if (session) {
    session.killFn = killFn;
  }
}

/**
 * 设置会话的 WebSocket writer（流式输出口）
 *
 * 刷新重连场景的关键：dockerStreamHandler 每个 stdout chunk 动态读取
 * session.writer（见 dockerStreamHandler.setupStdoutHandler）。
 * 新连接通过 subscribe-session 调用本函数替换 writer，使后续流式输出
 * （思考/文本/工具调用 delta）转发到新连接，实现"刷新后续传"。
 * @param {string} sessionId - 会话 ID
 * @param {object} writer - WebSocketWriter 实例
 */
export function setSessionWriter(sessionId, writer) {
  const session = containerSessions.get(sessionId);
  if (session) {
    session.writer = writer;
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
 * 获取会话信息（带所有权校验）
 *
 * 仅当请求者 userId 与会话创建者一致时返回会话，供 subscribe-session 鉴权，
 * 防止 A 用户 subscribe B 的会话截获输出。校验模式参照 getSessionStdin。
 * 失败时返回 null（不泄露会话存在性）。
 * @param {string} sessionId - 会话 ID
 * @param {number} userId - 请求者用户 ID
 * @returns {object|null} 会话信息，或 null（不存在/非本人）
 */
export function getSessionForUser(sessionId, userId) {
  const session = containerSessions.get(sessionId);
  if (!session) return null;
  if (userId !== undefined && session.userId !== undefined && session.userId !== userId) {
    logger.warn({ sessionId, requestedBy: userId, ownedBy: session.userId }, '[SessionManager] Session ownership mismatch on subscribe');
    return null;
  }
  return session;
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

  // 取消可能挂起的清理定时器（避免宽限期定时器在 abort 后重复触发）
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }

  // 1. 先 kill 容器内 SDK 进程。
  // 容器用非 TTY 模式，destroy stream 只断 attach 连接、不发信号给容器内进程，
  // 必须显式 kill，否则容器内 SDK 会继续执行后续 todo 直到任务自然完成（停止按钮失效）。
  // fire-and-forget：不 await，不阻塞 abort 响应；失败降级为只 destroy stream（进程可能已退出）。
  if (typeof session.killFn === 'function') {
    // Promise.resolve 统一处理同步抛出与异步 reject，避免 unhandled rejection（fire-and-forget，不阻塞 abort）
    Promise.resolve()
      .then(() => session.killFn())
      .then(() => {
        logger.info({ sessionId }, '[SessionManager] Triggered container process kill on abort');
      })
      .catch(err => {
        logger.debug({ err: err?.message || err, sessionId }, '[SessionManager] killFn failed (process may have exited)');
      });
  }

  // 2. 销毁宿主机读取容器输出的流，触发 handleStreamProcessing settle。
  // 传 Error 对象确保触发 'error' 事件，使 handleStreamProcessing 的
  // Promise settle（resolve/reject），从而释放挂起的 queryClaudeSDKInContainer。
  // 仅 destroy() 不传 error 可能只触发 'close' 而不触发 'error'，导致空挂。
  if (session.stream) {
    try {
      session.stream.destroy(new Error('Session aborted'));
      logger.debug({ sessionId }, '[SessionManager] Destroyed stream with error for session');
    } catch (error) {
      logger.error({ err: error, sessionId }, 'Error destroying stream for session');
    }
  }

  containerSessions.delete(sessionId);

  return true;
}

/**
 * 调度会话清理（延迟 abort）
 *
 * ws 断开后不再立即 abort 任务（支持刷新重连续传），改为启动宽限期定时器：
 * 期间若有新连接 subscribe 则由 cancelSessionCleanup 取消；超时未重连则
 * abortSession 释放容器资源并从 Map 删除，防止泄漏与资源占用。
 * 每次调用重置定时器（取最新 delay）。幂等：无会话/no-op。
 * @param {string} sessionId - 会话 ID
 * @param {number} delayMs - 延迟毫秒数
 */
export function scheduleSessionCleanup(sessionId, delayMs) {
  const session = containerSessions.get(sessionId);
  if (!session) return;
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }
  session.cleanupTimer = setTimeout(() => {
    logger.info({ sessionId }, '[SessionManager] Grace period elapsed, aborting session to release resources');
    abortSession(sessionId);
  }, delayMs);
}

/**
 * 取消会话清理定时器（新连接 subscribe 命中活跃会话时调用）
 * @param {string} sessionId - 会话 ID
 */
export function cancelSessionCleanup(sessionId) {
  const session = containerSessions.get(sessionId);
  if (session && session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }
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

