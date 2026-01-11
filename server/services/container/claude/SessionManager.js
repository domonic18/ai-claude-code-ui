/**
 * 容器化 Claude SDK 会话管理器
 * 
 * 负责跟踪和管理容器内运行的 Claude SDK 会话。
 */

// 容器化查询的会话跟踪
const containerSessions = new Map();

/**
 * 创建新会话
 * @param {string} sessionId - 会话 ID
 * @param {object} sessionInfo - 会话信息
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
 * @returns {boolean} 如果会话已中止则返回 true
 */
export function abortSession(sessionId) {
  const session = containerSessions.get(sessionId);
  
  if (!session) {
    return false;
  }
  
  session.status = 'aborted';
  session.endTime = Date.now();
  
  // 注意：实际中止需要终止 exec 进程
  // 这是一个简化的实现
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

