/**
 * MessageFilter.js
 *
 * 消息过滤器类 — 提供消息过滤、验证功能
 *
 * @module core/utils/message-filter/MessageFilter
 */

import { MESSAGE_CONSTANTS } from '../../types/message-types.js';

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
