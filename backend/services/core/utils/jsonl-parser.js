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
import {
  processSessionEntry, postProcessSessions, calculateStats
} from './jsonlSessionHelpers.js';

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
            processSessionEntry(sessions, entry, pendingSummaries, { includeApiErrors });
          }
        } catch { parseErrors++; }
      }

      const processedSessions = postProcessSessions(sessions, validateSessions);
      return { sessions: processedSessions, entries, stats: calculateStats(entries, processedSessions, parseErrors) };
    } catch (error) {
      logger.error('[JsonlParser] Error parsing JSONL content:', error);
      return { sessions: [], entries: [], stats: { totalEntries: 0, totalSessions: 0, parseErrors: 0 } };
    }
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
