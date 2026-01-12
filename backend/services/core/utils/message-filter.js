/**
 * message-filter.js
 *
 * 统一的消息过滤工具
 * 提供消息过滤、验证和转换功能
 *
 * @module core/utils/message-filter
 */

import { MESSAGE_CONSTANTS, MessageType, MessageRole } from '../types/message-types.js';

/**
 * 消息过滤器类
 */
export class MessageFilter {
  /**
   * 过滤系统消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Array<Object>} 过滤后的消息列表
   */
  static filterSystemMessages(messages) {
    return messages.filter(message => !this.isSystemMessage(message));
  }

  /**
   * 过滤 API 错误消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Array<Object>} 过滤后的消息列表
   */
  static filterApiErrorMessages(messages) {
    return messages.filter(message => !this.isApiErrorMessage(message));
  }

  /**
   * 按角色过滤消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @param {string} role - 角色（'user', 'assistant', 'system'）
   * @returns {Array<Object>} 过滤后的消息列表
   */
  static filterByRole(messages, role) {
    return messages.filter(message => message.role === role);
  }

  /**
   * 按类型过滤消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @param {string} type - 类型
   * @returns {Array<Object>} 过滤后的消息列表
   */
  static filterByType(messages, type) {
    return messages.filter(message => message.type === type);
  }

  /**
   * 按日期范围过滤消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Array<Object>} 过滤后的消息列表
   */
  static filterByDateRange(messages, startDate, endDate) {
    return messages.filter(message => {
      const timestamp = message.timestamp ? new Date(message.timestamp) : null;
      if (!timestamp) return false;
      return timestamp >= startDate && timestamp <= endDate;
    });
  }

  /**
   * 获取有效的消息（非系统消息、非 API 错误）
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Array<Object>} 有效的消息列表
   */
  static getValidMessages(messages) {
    return messages.filter(message =>
      !this.isSystemMessage(message) && !this.isApiErrorMessage(message)
    );
  }

  /**
   * 判断是否为系统消息
   *
   * @param {Object} message - 消息对象
   * @returns {boolean} 是否为系统消息
   */
  static isSystemMessage(message) {
    if (!message || !message.message) return false;

    let textContent = message.message;

    // 处理数组格式内容
    if (Array.isArray(message.message) && message.message.length > 0) {
      const firstPart = message.message[0];
      if (firstPart.type === 'text') {
        textContent = firstPart.text;
      } else {
        return false;
      }
    }

    if (typeof textContent !== 'string') return false;

    // 检查系统消息前缀
    return MESSAGE_CONSTANTS.SYSTEM_MESSAGE_PREFIXES.some(prefix =>
      textContent.startsWith(prefix)
    );
  }

  /**
   * 判断是否为 API 错误消息
   *
   * @param {Object} message - 消息对象
   * @returns {boolean} 是否为 API 错误消息
   */
  static isApiErrorMessage(message) {
    // 首先检查显式标记
    if (message && message.isApiErrorMessage === true) {
      return true;
    }

    if (!message || !message.message) return false;

    let textContent = message.message;

    // 处理数组格式内容
    if (Array.isArray(message.message) && message.message.length > 0) {
      const firstPart = message.message[0];
      if (firstPart.type === 'text') {
        textContent = firstPart.text;
      } else {
        return false;
      }
    }

    if (typeof textContent !== 'string') return false;

    // 检查 API 错误标识
    return MESSAGE_CONSTANTS.API_ERROR_INDICATORS.some(indicator =>
      textContent.includes(indicator)
    );
  }

  /**
   * 提取消息文本内容
   *
   * @param {Object} message - 消息对象
   * @returns {string|null} 文本内容
   */
  static extractText(message) {
    if (!message || !message.message) return null;

    // 字符串格式
    if (typeof message.message === 'string') {
      return message.message;
    }

    // 数组格式
    if (Array.isArray(message.message)) {
      for (const part of message.message) {
        if (part.type === 'text' && part.text) {
          return part.text;
        }
      }
    }

    // 对象格式
    if (typeof message.message === 'object' && message.message.text) {
      return message.message.text;
    }

    return null;
  }

  /**
   * 截断消息文本
   *
   * @param {string} text - 文本内容
   * @param {number} maxLength - 最大长度
   * @param {string} [suffix='...'] - 截断后缀
   * @returns {string} 截断后的文本
   */
  static truncateText(text, maxLength, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + suffix;
  }

  /**
   * 格式化消息时间戳
   *
   * @param {Date|string} timestamp - 时间戳
   * @param {string} [format='iso'] - 格式类型 ('iso', 'locale', 'relative')
   * @returns {string} 格式化后的时间
   */
  static formatTimestamp(timestamp, format = 'iso') {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

    switch (format) {
      case 'iso':
        return date.toISOString();
      case 'locale':
        return date.toLocaleString();
      case 'relative':
        return this.getRelativeTimeString(date);
      default:
        return date.toISOString();
    }
  }

  /**
   * 获取相对时间字符串
   *
   * @param {Date} date - 日期
   * @returns {string} 相对时间字符串
   */
  static getRelativeTimeString(date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return `${seconds}s ago`;
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

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

/**
 * 消息聚合器类
 */
export class MessageAggregator {
  /**
   * 计算消息统计
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Object} 统计信息
   */
  static aggregateStats(messages) {
    const stats = {
      totalCount: messages.length,
      byRole: {},
      byType: {},
      tokenUsage: {
        input: 0,
        cacheCreation: 0,
        cacheRead: 0,
        output: 0,
        total: 0,
      },
      timeRange: {
        first: null,
        last: null,
      },
    };

    for (const message of messages) {
      // 按角色统计
      if (message.role) {
        stats.byRole[message.role] = (stats.byRole[message.role] || 0) + 1;
      }

      // 按类型统计
      if (message.type) {
        stats.byType[message.type] = (stats.byType[message.type] || 0) + 1;
      }

      // Token 使用统计
      if (message.usage) {
        const input = message.usage.input_tokens || 0;
        const cacheCreation = message.usage.cache_creation_input_tokens || 0;
        const cacheRead = message.usage.cache_read_input_tokens || 0;
        const output = message.usage.output_tokens || 0;

        stats.tokenUsage.input += input;
        stats.tokenUsage.cacheCreation += cacheCreation;
        stats.tokenUsage.cacheRead += cacheRead;
        stats.tokenUsage.output += output;
      }

      // 时间范围
      if (message.timestamp) {
        const timestamp = new Date(message.timestamp);
        if (!stats.timeRange.first || timestamp < stats.timeRange.first) {
          stats.timeRange.first = timestamp;
        }
        if (!stats.timeRange.last || timestamp > stats.timeRange.last) {
          stats.timeRange.last = timestamp;
        }
      }
    }

    stats.tokenUsage.total =
      stats.tokenUsage.input +
      stats.tokenUsage.cacheCreation +
      stats.tokenUsage.cacheRead +
      stats.tokenUsage.output;

    return stats;
  }

  /**
   * 按日期聚合消息
   *
   * @param {Array<Object>} messages - 消息列表
   * @returns {Map<string, number>} 按日期聚合的消息数量
   */
  static aggregateByDate(messages) {
    const aggregation = new Map();

    for (const message of messages) {
      if (!message.timestamp) continue;

      const date = new Date(message.timestamp);
      const dateKey = date.toISOString().split('T')[0];

      aggregation.set(dateKey, (aggregation.get(dateKey) || 0) + 1);
    }

    return aggregation;
  }
}

export default {
  MessageFilter,
  MessageTransformer,
  MessageAggregator,
};
