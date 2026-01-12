/**
 * jsonl-parser.js
 *
 * 统一的 JSONL 解析器
 * 合并重复的 JSONL 解析逻辑，支持容器和非容器模式
 *
 * @module core/utils/jsonl-parser
 */

import { MESSAGE_CONSTANTS } from '../types/message-types.js';

/**
 * 系统消息前缀列表（与 message-types.js 保持一致）
 */
const SYSTEM_MESSAGE_PREFIXES = [
  '<command-name>',
  '<command-message>',
  '<command-args>',
  '<local-command-stdout>',
  '<system-reminder>',
  'Caveat:',
  'This session is being continued from a previous',
  'Invalid API key',
  'Warmup',
];

/**
 * API 错误消息标识
 */
const API_ERROR_INDICATORS = [
  '{"subtasks":',
  'CRITICAL: You MUST respond with ONLY a JSON',
];

/**
 * JSONL 解析器类
 * 提供 JSONL 文件解析功能，用于解析 Claude Code 会话文件
 */
export class JsonlParser {
  /**
   * 解析 JSONL 文件内容
   * @param {string} content - JSONL 文件内容
   * @param {Object} options - 解析选项
   * @param {boolean} [options.includeSystemMessages=false] - 是否包含系统消息
   * @param {boolean} [options.includeApiErrors=false] - 是否包含 API 错误消息
   * @param {boolean} [options.validateSessions=true] - 是否验证会话
   * @returns {Object} 解析结果 { sessions, entries, stats }
   */
  static parse(content, options = {}) {
    const {
      includeSystemMessages = false,
      includeApiErrors = false,
      validateSessions = true,
    } = options;

    const sessions = new Map();
    const entries = [];
    const pendingSummaries = new Map();
    let parseErrors = 0;

    try {
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line);
          entries.push(entry);

          // 处理 summary 条目
          if (entry.type === 'summary' && entry.summary && !entry.sessionId && entry.leafUuid) {
            pendingSummaries.set(entry.leafUuid, entry.summary);
          }

          // 处理会话条目
          if (entry.sessionId) {
            this._processSessionEntry(
              sessions,
              entry,
              pendingSummaries,
              { includeSystemMessages, includeApiErrors }
            );
          }
        } catch (parseError) {
          parseErrors++;
        }
      }

      // 后处理会话
      const processedSessions = this._postProcessSessions(sessions, validateSessions);

      // 统计信息
      const stats = this._calculateStats(entries, processedSessions, parseErrors);

      return {
        sessions: processedSessions,
        entries,
        stats,
      };
    } catch (error) {
      console.error('[JsonlParser] Error parsing JSONL content:', error);
      return {
        sessions: [],
        entries: [],
        stats: { totalEntries: 0, totalSessions: 0, parseErrors: 0 },
      };
    }
  }

  /**
   * 处理单个会话条目
   * @private
   */
  static _processSessionEntry(sessions, entry, pendingSummaries, options) {
    const { includeSystemMessages, includeApiErrors } = options;

    // 初始化会话
    if (!sessions.has(entry.sessionId)) {
      sessions.set(entry.sessionId, {
        id: entry.sessionId,
        summary: 'New Session',
        messageCount: 0,
        lastActivity: new Date(),
        cwd: entry.cwd || '',
        lastUserMessage: null,
        lastAssistantMessage: null,
      });
    }

    const session = sessions.get(entry.sessionId);

    // 应用待处理的摘要
    if (session.summary === 'New Session' && entry.parentUuid && pendingSummaries.has(entry.parentUuid)) {
      session.summary = pendingSummaries.get(entry.parentUuid);
    }

    // 从 summary 条目更新摘要
    if (entry.type === 'summary' && entry.summary) {
      session.summary = entry.summary;
    }

    // 处理用户消息（支持两种格式）
    // 格式1: { role: 'user', message: '...' }
    // 格式2: { message: { role: 'user', content: '...' } }
    const isUserMessage = entry.role === 'user' || entry.message?.role === 'user';
    if (isUserMessage && entry.message) {
      const textContent = this._extractTextContent(entry.message);
      const isSystemMessage = this._isSystemMessage(textContent);

      if (textContent && !isSystemMessage) {
        session.lastUserMessage = textContent;
      }
    }

    // 处理助手消息（支持两种格式）
    const isAssistantMessage = entry.role === 'assistant' || entry.message?.role === 'assistant';
    if (isAssistantMessage && entry.message) {
      if (entry.isApiErrorMessage === true && !includeApiErrors) {
        // 跳过 API 错误消息
        return;
      }

      const textContent = this._extractTextContent(entry.message);
      const isSystemMessage = this._isApiErrorMessage(textContent);

      if (textContent && !isSystemMessage) {
        session.lastAssistantMessage = textContent;
      }
    }

    // 更新消息计数和活动时间
    session.messageCount++;
    if (entry.timestamp) {
      session.lastActivity = new Date(entry.timestamp);
    }
  }

  /**
   * 后处理会话数据
   * @private
   */
  static _postProcessSessions(sessions, validateSessions) {
    const allSessions = Array.from(sessions.values());

    // 为没有摘要的会话设置默认摘要
    for (const session of allSessions) {
      if (session.summary === 'New Session') {
        const lastMessage = session.lastUserMessage || session.lastAssistantMessage;
        if (lastMessage) {
          session.summary = lastMessage.length > 50
            ? lastMessage.substring(0, 50) + '...'
            : lastMessage;
        }
      }
    }

    // 验证会话（过滤掉无效会话）
    if (validateSessions) {
      return allSessions.filter(session => {
        // 过滤掉 JSON 响应错误（Task Master 错误）
        if (session.summary.startsWith('{ "')) {
          return false;
        }
        // 过滤掉空会话
        if (session.messageCount === 0) {
          return false;
        }
        return true;
      });
    }

    return allSessions;
  }

  /**
   * 提取文本内容
   * @private
   */
  static _extractTextContent(messageContent) {
    // 字符串格式
    if (typeof messageContent === 'string') {
      return messageContent;
    }

    // 数组格式
    if (Array.isArray(messageContent) && messageContent.length > 0) {
      const firstPart = messageContent[0];
      if (firstPart.type === 'text') {
        return firstPart.text;
      }
    }

    return null;
  }

  /**
   * 判断是否为系统消息
   * @private
   */
  static _isSystemMessage(text) {
    if (typeof text !== 'string') return false;

    return SYSTEM_MESSAGE_PREFIXES.some(prefix => text.startsWith(prefix));
  }

  /**
   * 判断是否为 API 错误消息
   * @private
   */
  static _isApiErrorMessage(text) {
    if (typeof text !== 'string') return false;

    return API_ERROR_INDICATORS.some(indicator => text.includes(indicator));
  }

  /**
   * 计算统计信息
   * @private
   */
  static _calculateStats(entries, sessions, parseErrors) {
    return {
      totalEntries: entries.length,
      totalSessions: sessions.length,
      parseErrors,
      validSessions: sessions.filter(s => s.messageCount > 0).length,
    };
  }

  /**
   * 解析单个 JSONL 行
   * @param {string} line - JSONL 行
   * @returns {Object|null} 解析后的对象，解析失败返回 null
   */
  static parseLine(line) {
    if (!line || !line.trim()) return null;

    try {
      return JSON.parse(line);
    } catch (error) {
      console.warn('[JsonlParser] Failed to parse line:', error.message);
      return null;
    }
  }

  /**
   * 将对象序列化为 JSONL 行
   * @param {Object} obj - 要序列化的对象
   * @returns {string} JSONL 行
   */
  static serialize(obj) {
    return JSON.stringify(obj);
  }

  /**
   * 将多个对象序列化为 JSONL 内容
   * @param {Array<Object>} objects - 要序列化的对象数组
   * @returns {string} JSONL 内容
   */
  static serializeAll(objects) {
    return objects.map(obj => this.serialize(obj)).join('\n') + '\n';
  }
}

/**
 * 会话分组器
 * 用于对会话进行分组处理
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
        const firstUserMsgId = entry.uuid;

        if (!sessionToFirstUserMsgId.has(entry.sessionId)) {
          sessionToFirstUserMsgId.set(entry.sessionId, firstUserMsgId);
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
        sessionGroups.set(firstUserMsgId, {
          latestSession: session,
          allSessions: [session],
        });
      } else {
        const group = sessionGroups.get(firstUserMsgId);
        group.allSessions.push(session);

        if (new Date(session.lastActivity) > new Date(group.latestSession.lastActivity)) {
          group.latestSession = session;
        }
      }
    }

    // 构建最终结果
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

    // 收集分组中的会话 ID
    const groupedSessionIds = new Set();
    for (const session of sessions) {
      const firstUserMsgId = sessionToFirstUserMsgId.get(session.id);
      if (firstUserMsgId) {
        const group = sessionGroups.find(g => {
          // 检查是否在这个分组中
          return g.allSessions && g.allSessions.some(s => s.id === session.id);
        });
        if (group) {
          groupedSessionIds.add(session.id);
        }
      }
    }

    // 分离独立会话
    const standaloneSessions = sessions.filter(session => !groupedSessionIds.has(session.id));

    return {
      grouped: sessionGroups,
      standalone: standaloneSessions,
    };
  }
}

/**
 * Token 使用统计器
 * 用于计算 JSONL 文件中的 Token 使用情况
 */
export class TokenUsageCalculator {
  /**
   * 计算条目的 Token 使用量
   * @param {Object} entry - JSONL 条目
   * @returns {Object} Token 使用统计
   */
  static calculateEntryTokens(entry) {
    if (!entry.usage) {
      return { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, total: 0 };
    }

    const usage = entry.usage;
    const input = usage.input_tokens || 0;
    const cacheCreation = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const output = usage.output_tokens || 0;

    return {
      input,
      cacheCreation,
      cacheRead,
      output,
      total: input + cacheCreation + cacheRead + output,
    };
  }

  /**
   * 计算 JSONL 内容的总 Token 使用量
   * @param {string} content - JSONL 文件内容
   * @returns {Object} Token 使用统计
   */
  static calculateTotalTokens(content) {
    const { entries } = JsonlParser.parse(content);
    let totalTokens = 0;
    let inputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;

    for (const entry of entries) {
      const tokens = this.calculateEntryTokens(entry);
      inputTokens += tokens.input;
      cacheCreationTokens += tokens.cacheCreation;
      cacheReadTokens += tokens.cacheRead;
      totalTokens += tokens.output;
    }

    totalTokens += inputTokens + cacheCreationTokens + cacheReadTokens;

    return {
      used: totalTokens,
      total: 200000, // Claude 默认限制
      breakdown: {
        input: inputTokens,
        cacheCreation: cacheCreationTokens,
        cacheRead: cacheReadTokens,
      },
    };
  }
}

export default {
  JsonlParser,
  SessionGrouping,
  TokenUsageCalculator,
};
