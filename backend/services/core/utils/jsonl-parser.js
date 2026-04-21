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

/**
 * JSONL 格式解析器
 *
 * 解析 JSONL 格式的 Claude Code 会话文件，提取会话列表、条目和统计信息。
 * 支持摘要关联（通过 leafUuid）和可选的 API 错误包含。
 */
export class JsonlParser {
  /**
   * 解析完整的 JSONL 内容字符串
   *
   * 逐行解析 JSONL，将条目按 sessionId 归组为会话，处理 summary 条目的关联，
   * 最终返回会话列表、原始条目数组和统计数据。
   *
   * @param {string} content - JSONL 格式的完整文本内容
   * @param {Object} [options] - 解析选项
   * @param {boolean} [options.includeSystemMessages=false] - 是否包含系统消息
   * @param {boolean} [options.includeApiErrors=false] - 是否包含 API 错误条目
   * @param {boolean} [options.validateSessions=true] - 是否验证会话完整性
   * @returns {{sessions: Array, entries: Array, stats: Object}} 解析结果
   */
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

  /**
   * 解析单行 JSONL 文本
   *
   * @param {string} line - 单行 JSON 文本
   * @returns {Object|null} 解析后的对象，格式错误时返回 null
   */
  static parseLine(line) {
    if (!line || !line.trim()) return null;
    try { return JSON.parse(line); } catch { logger.warn('[JsonlParser] Failed to parse line'); return null; }
  }

  /** 将对象序列化为 JSON 字符串 */
  static serialize(obj) { return JSON.stringify(obj); }
  /** 将对象数组序列化为 JSONL 格式（每行一个 JSON） */
  static serializeAll(objects) { return objects.map(obj => this.serialize(obj)).join('\n') + '\n'; }
}

// ─── 兼容层：原 sessionParser.js 的公共 API ─────────────────

/**
 * 解析 JSONL 内容（简化版 API）
 *
 * JsonlParser.parse 的便捷封装，使用默认选项。
 *
 * @param {string} content - JSONL 格式的文本内容
 * @returns {{sessions: Array, entries: Array}} 会话列表和原始条目
 */
export function parseJsonlContent(content) {
  const result = JsonlParser.parse(content, { includeSystemMessages: false, includeApiErrors: false, validateSessions: true });
  return { sessions: result.sessions, entries: result.entries };
}

/**
 * 从条目中过滤敏感的内存上下文信息
 *
 * 对 user 角色的消息内容执行 filterMemoryContext 过滤，
 * 移除可能包含敏感信息的记忆上下文段落。
 *
 * @param {Object} entry - JSONL 条目对象
 * @param {Object} entry.message - 消息对象
 * @param {string} entry.message.role - 消息角色（仅处理 'user'）
 * @param {*} entry.message.content - 消息内容
 * @returns {Object} 过滤后的条目（内容被修改时返回新对象）
 */
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
