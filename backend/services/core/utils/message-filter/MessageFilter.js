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
   * 从消息中提取文本内容（内部共享辅助函数）
   *
   * 统一处理字符串、数组、对象三种消息格式，
   * 供 isSystemMessage / isApiErrorMessage / extractText 共用。
   *
   * @param {Object} message - 消息对象
   * @param {boolean} firstOnly - 数组格式时仅取第一个文本部分
   * @returns {string|null} 文本内容
   * @private
   */
  static _resolveTextContent(message, firstOnly = true) {
    if (!message || !message.message) return null;

    const raw = message.message;

    // 字符串格式
    if (typeof raw === 'string') return raw;

    // 数组格式
    if (Array.isArray(raw)) {
      if (firstOnly) {
        const first = raw[0];
        return (first?.type === 'text') ? first.text : null;
      }
      for (const part of raw) {
        if (part.type === 'text' && part.text) return part.text;
      }
      return null;
    }

    // 对象格式
    if (typeof raw === 'object' && raw.text) return raw.text;

    return null;
  }

  /**
   * 判断是否为系统消息
   *
   * @param {Object} message - 消息对象
   * @returns {boolean} 是否为系统消息
   */
  static isSystemMessage(message) {
    const text = this._resolveTextContent(message, true);
    if (typeof text !== 'string') return false;
    return MESSAGE_CONSTANTS.SYSTEM_MESSAGE_PREFIXES.some(prefix => text.startsWith(prefix));
  }

  /**
   * 判断是否为 API 错误消息
   *
   * @param {Object} message - 消息对象
   * @returns {boolean} 是否为 API 错误消息
   */
  static isApiErrorMessage(message) {
    if (message?.isApiErrorMessage === true) return true;
    const text = this._resolveTextContent(message, true);
    if (typeof text !== 'string') return false;
    return MESSAGE_CONSTANTS.API_ERROR_INDICATORS.some(indicator => text.includes(indicator));
  }

  /**
   * 提取消息文本内容
   *
   * @param {Object} message - 消息对象
   * @returns {string|null} 文本内容
   */
  static extractText(message) {
    return this._resolveTextContent(message, false);
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
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

    const THRESHOLDS = [
      [60, () => `${diffSec}s ago`],
      [3600, () => `${Math.floor(diffSec / 60)}m ago`],
      [86400, () => `${Math.floor(diffSec / 3600)}h ago`],
      [604800, () => `${Math.floor(diffSec / 86400)}d ago`],
    ];

    for (const [limit, formatter] of THRESHOLDS) {
      if (diffSec < limit) return formatter();
    }
    return date.toLocaleDateString();
  }
}
