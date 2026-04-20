/**
 * 会话分组模块
 *
 * 负责将会话按 firstUserMsgId 分组，合并相关会话。
 *
 * @module sessions/container/sessionGrouping
 */

/**
 * 根据条目和会话数据构建会话分组
 * 同一个 firstUserMsgId 关联的会话会被合并为一组
 * @param {Array} allEntries - 所有解析后的条目
 * @param {Map} allSessions - 所有会话 Map
 * @returns {Map} firstUserMsgId → { latestSession, allSessions }
 */
export function buildSessionGroups(allEntries, allSessions) {
  const sessionGroups = new Map();
  const sessionToFirstUserMsgId = new Map();

  allEntries.forEach(entry => {
    if (!(entry.sessionId && entry.type === 'user' && entry.parentUuid === null && entry.uuid)) return;

    const firstUserMsgId = entry.uuid;
    if (sessionToFirstUserMsgId.has(entry.sessionId)) return;

    sessionToFirstUserMsgId.set(entry.sessionId, firstUserMsgId);
    const session = allSessions.get(entry.sessionId);
    if (session) addToSessionGroup(sessionGroups, firstUserMsgId, session);
  });

  return sessionGroups;
}

/**
 * 将会话添加到分组（新建或更新现有分组）
 * @param {Map} sessionGroups - 分组 Map
 * @param {string} firstUserMsgId - 首条用户消息 ID
 * @param {Object} session - 会话对象
 */
export function addToSessionGroup(sessionGroups, firstUserMsgId, session) {
  if (!sessionGroups.has(firstUserMsgId)) {
    sessionGroups.set(firstUserMsgId, {
      latestSession: session,
      allSessions: [session]
    });
    return;
  }

  const group = sessionGroups.get(firstUserMsgId);
  group.allSessions.push(session);

  if (new Date(session.lastActivity) > new Date(group.latestSession.lastActivity)) {
    group.latestSession = session;
  }
}

/**
 * 合并分组会话和独立会话，返回排序后的完整列表
 * @param {Map} sessionGroups - firstUserMsgId → { latestSession, allSessions }
 * @param {Map} allSessions - 所有会话 Map
 * @returns {Array} 排序后的会话列表
 */
export function mergeGroupedAndStandalone(sessionGroups, allSessions) {
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
