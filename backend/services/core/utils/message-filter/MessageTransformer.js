/**
 * MessageTransformer.js
 *
 * 消息转换器类 — 提供消息格式转换、分组、排序、分页功能
 *
 * @module core/utils/message-filter/MessageTransformer
 */

import { MessageFilter } from './MessageFilter.js';

/**
 * 消息转换器类
 */
export class MessageTransformer {
  /**
   * 将消息转换为简化格式
   *
   * @param {Object} message - 消息对象
   * @returns {Object} 简化后的消息
   */
  static simplify(message) {
    return {
      uuid: message.uuid,
      type: message.type,
      role: message.role,
      text: MessageFilter.extractText(message),
      timestamp: message.timestamp,
      usage: message.usage,
    };
  }

  /**
   * 批量简化消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Array<Object>} 简化后的消息列表
   */
  static simplifyAll(messages) {
    return messages.map(message => this.simplify(message));
  }

  /**
   * 将消息转换为显示格式
   *
   * @param {Object} message - 消息对象
   * @param {Object} options - 选项
   * @param {boolean} [options.includeUsage=false] - 是否包含 Token 使用情况
   * @param {boolean} [options.includeTimestamp=true] - 是否包含时间戳
   * @param {string} [options.timestampFormat='locale'] - 时间戳格式
   * @returns {Object} 显示格式的消息
   */
  static toDisplayFormat(message, options = {}) {
    const {
      includeUsage = false,
      includeTimestamp = true,
      timestampFormat = 'locale',
    } = options;

    const result = {
      role: message.role,
      content: MessageFilter.extractText(message),
    };

    if (includeTimestamp && message.timestamp) {
      result.timestamp = MessageFilter.formatTimestamp(message.timestamp, timestampFormat);
    }

    if (includeUsage && message.usage) {
      result.usage = message.usage;
    }

    return result;
  }

  /**
   * 按会话分组消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Map<string, Array<Object>>} 按 sessionId 分组的消息
   */
  static groupBySession(messages) {
    const groups = new Map();

    for (const message of messages) {
      const sessionId = message.sessionId;
      if (!sessionId) continue;

      if (!groups.has(sessionId)) {
        groups.set(sessionId, []);
      }
      groups.get(sessionId).push(message);
    }

    return groups;
  }

  /**
   * 按时间排序消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @param {'asc'|'desc'} [order='asc'] - 排序方向
   * @returns {Array<Object>} 排序后的消息列表
   */
  static sortByTimestamp(messages, order = 'asc') {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return order === 'asc' ? timeA - timeB : timeB - timeB;
    });
  }

  /**
   * 分页消息列表
   *
   * @param {Array<Object>} messages - 消息列表
   * @param {number} [limit=50] - 每页数量
   * @param {number} [offset=0] - 偏移量
   * @returns {Object} 分页结果 { messages, total, hasMore, offset, limit }
   */
  static paginate(messages, limit = 50, offset = 0) {
    const total = messages.length;
    const paginatedMessages = messages.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      messages: paginatedMessages,
      total,
      hasMore,
      offset,
      limit,
    };
  }
}
