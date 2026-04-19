/**
 * JSONL 解析器
 *
 * 解析 JSONL 格式的 Claude Code 会话文件，
 * 合并了原 sessionParser.js 的功能（filterMemoryContext 集成）。
 *
 * @module core/utils/jsonl-parser
 */

import { createLogger } from '../../../utils/logger.js';
import {
  createSession, extractTextFromEntry, _extractTextContent, processUserEntry, processAssistantEntry
} from './jsonlHelpers.js';
import { filterMemoryContext } from '../../../utils/memoryUtils.js';
const logger = createLogger('services/core/utils/jsonl-parser');

// ─── JsonlParser 类 ─────────────────────────────────────

export class JsonlParser {
  static parse(content, options = {}) {
    const { includeSystemMessages = false, includeApiErrors = false, validateSessions = true } = options;
    const sessions = new Map();
    const entries = [];
    const pendingSummaries = new Map();
    let parseErrors = 0;

    try {
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          entries.push(entry);
          if (entry.type === 'summary' && entry.summary && !entry.sessionId && entry.leafUuid) {
            pendingSummaries.set(entry.leafUuid, entry.summary);
          }
          if (entry.sessionId) {
            this._processSessionEntry(sessions, entry, pendingSummaries, { includeApiErrors });
          }
        } catch { parseErrors++; }
      }

      const processedSessions = this._postProcessSessions(sessions, validateSessions);
      return { sessions: processedSessions, entries, stats: this._calculateStats(entries, processedSessions, parseErrors) };
    } catch (error) {
      logger.error('[JsonlParser] Error parsing JSONL content:', error);
      return { sessions: [], entries: [], stats: { totalEntries: 0, totalSessions: 0, parseErrors: 0 } };
    }
  }

  static _processSessionEntry(sessions, entry, pendingSummaries, options) {
    if (!sessions.has(entry.sessionId)) {
      sessions.set(entry.sessionId, createSession(entry.sessionId, entry.cwd));
    }
    const session = sessions.get(entry.sessionId);

    this._resolveSessionSummary(session, entry, pendingSummaries);
    this._processEntryByRole(session, entry, options.includeApiErrors);

    session.messageCount++;
    if (entry.timestamp) session.lastActivity = new Date(entry.timestamp);
  }

  /**
   * 解析并更新会话摘要
   * @param {Object} session - 会话对象
   * @param {Object} entry - JSONL 条目
   * @param {Map} pendingSummaries - 待匹配的摘要映射
   * @private
   */
  static _resolveSessionSummary(session, entry, pendingSummaries) {
    if (session.summary === 'New Session' && entry.parentUuid && pendingSummaries.has(entry.parentUuid)) {
      session.summary = pendingSummaries.get(entry.parentUuid);
    }
    if (entry.type === 'summary' && entry.summary) {
      session.summary = entry.summary;
    }
  }

  /**
   * 根据角色分发处理条目
   * @param {Object} session - 会话对象
   * @param {Object} entry - JSONL 条目
   * @param {boolean} includeApiErrors - 是否包含 API 错误
   * @private
   */
  static _processEntryByRole(session, entry, includeApiErrors) {
    const role = entry.role || entry.message?.role;
    if (!entry.message) return;

    if (role === 'user') processUserEntry(session, entry);
    else if (role === 'assistant') processAssistantEntry(session, entry, includeApiErrors);
  }

  static _postProcessSessions(sessions, validateSessions) {
    const allSessions = Array.from(sessions.values());
    for (const session of allSessions) {
      if (session.summary === 'New Session') {
        this._fillDefaultSummary(session);
      }
    }
    return validateSessions
      ? allSessions.filter(s => !s.summary.startsWith('{ "') && s.messageCount > 0)
      : allSessions;
  }

  /**
   * 用最后一条消息填充默认摘要
   * @param {Object} session - 会话对象
   * @private
   */
  static _fillDefaultSummary(session) {
    const lastMessage = session.lastUserMessage || session.lastAssistantMessage;
    if (!lastMessage) return;
    session.summary = lastMessage.length > 50
      ? lastMessage.substring(0, 50) + '...'
      : lastMessage;
  }

  static _calculateStats(entries, sessions, parseErrors) {
    return { totalEntries: entries.length, totalSessions: sessions.length, parseErrors, validSessions: sessions.filter(s => s.messageCount > 0).length };
  }

  static parseLine(line) {
    if (!line || !line.trim()) return null;
    try { return JSON.parse(line); } catch { logger.warn('[JsonlParser] Failed to parse line'); return null; }
  }

  static serialize(obj) { return JSON.stringify(obj); }
  static serializeAll(objects) { return objects.map(obj => this.serialize(obj)).join('\n') + '\n'; }
}

// ─── 兼容层：原 sessionParser.js 的公共 API ─────────────────

export function parseJsonlContent(content) {
  const result = JsonlParser.parse(content, { includeSystemMessages: false, includeApiErrors: false, validateSessions: true });
  return { sessions: result.sessions, entries: result.entries };
}

export function filterMemoryContextFromEntry(entry) {
  if (entry.message?.role === 'user' && entry.message?.content) {
    const textContent = _extractTextContent(entry.message.content);
    const filteredContent = filterMemoryContext(textContent);
    if (filteredContent !== textContent) {
      return { ...entry, message: { ...entry.message, content: filteredContent } };
    }
  }
  return entry;
}

export default { JsonlParser };

// ─── 从拆分模块重新导出，保持向后兼容 ─────────────────────

export { SessionGrouping } from './jsonl/SessionGrouping.js';
export { TokenUsageCalculator } from './jsonl/TokenUsageCalculator.js';
