/**
 * 会话分组器
 * 用于对 JSONL 会话进行分组处理
 *
 * @module core/utils/jsonl/SessionGrouping
 */

/**
 * 会话分组器类
 */
export class SessionGrouping {
  /**
   * 对会话进行分组
   * @param {Array} entries - JSONL 条目数组
   * @returns {Map<string, Object>} 分组后的会话映射
   */
  static groupSessions(entries) {
    const sessionToFirstUserMsgId = new Map();

    for (const entry of entries) {
      if (entry.sessionId && entry.type === 'user' && entry.parentUuid === null && entry.uuid) {
        if (!sessionToFirstUserMsgId.has(entry.sessionId)) {
          sessionToFirstUserMsgId.set(entry.sessionId, entry.uuid);
        }
      }
    }

    return sessionToFirstUserMsgId;
  }

  /**
   * 构建会话分组结果
   * @param {Array<Object>} sessions - 会话数组
   * @param {Map} sessionToFirstUserMsgId - 会话到第一条用户消息的映射
   * @returns {Array} 分组后的会话数组
   */
  static buildGroupedSessions(sessions, sessionToFirstUserMsgId) {
    const sessionGroups = new Map();

    for (const session of sessions) {
      const firstUserMsgId = sessionToFirstUserMsgId.get(session.id);

      if (!sessionGroups.has(firstUserMsgId)) {
        sessionGroups.set(firstUserMsgId, { latestSession: session, allSessions: [session] });
      } else {
        const group = sessionGroups.get(firstUserMsgId);
        group.allSessions.push(session);
        if (new Date(session.lastActivity) > new Date(group.latestSession.lastActivity)) {
          group.latestSession = session;
        }
      }
    }

    const result = [];
    for (const group of sessionGroups.values()) {
      const session = { ...group.latestSession };
      if (group.allSessions.length > 1) {
        session.isGrouped = true;
        session.groupSize = group.allSessions.length;
        session.groupSessions = group.allSessions.map(s => s.id);
      }
      result.push(session);
    }

    return result.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  /**
   * 分离独立会话和分组会话
   * @param {Array<Object>} sessions - 会话数组
   * @param {Map} sessionToFirstUserMsgId - 会话到第一条用户消息的映射
   * @returns {Object} { grouped, standalone }
   */
  static separateSessions(sessions, sessionToFirstUserMsgId) {
    const sessionGroups = this.buildGroupedSessions(sessions, sessionToFirstUserMsgId);

    const groupedSessionIds = new Set();
    for (const session of sessions) {
      const firstUserMsgId = sessionToFirstUserMsgId.get(session.id);
      if (firstUserMsgId) {
        const group = sessionGroups.find(g =>
          g.allSessions && g.allSessions.some(s => s.id === session.id)
        );
        if (group) groupedSessionIds.add(session.id);
      }
    }

    return {
      grouped: sessionGroups,
      standalone: sessions.filter(session => !groupedSessionIds.has(session.id)),
    };
  }
}
