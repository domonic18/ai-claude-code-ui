/**
 * message-types.js
 *
 * 消息相关类型定义
 *
 * @module core/types/message-types
 */

/**
 * 会话消息对象
 * @typedef {Object} SessionMessage
 * @property {string} uuid - 消息唯一标识符
 * @property {string} sessionId - 所属会话 ID
 * @property {string} type - 消息类型
 * @property {string} [role] - 消息角色（'user' | 'assistant' | 'system'）
 * @property {Object|string} message - 消息内容
 * @property {Date} timestamp - 时间戳
 * @property {string} [cwd] - 工作目录
 * @property {Object} [usage] - Token 使用情况
 * @property {string|null} [parentUuid] - 父消息 UUID
 * @property {string} [status] - 消息状态
 * @property {boolean} [isApiErrorMessage] - 是否为 API 错误消息
 */

/**
 * 消息使用情况
 * @typedef {Object} MessageUsage
 * @property {number} input_tokens - 输入 Token 数
 * @property {number} [cache_creation_input_tokens] - 缓存创建 Token 数
 * @property {number} [cache_read_input_tokens] - 缓存读取 Token 数
 * @property {number} output_tokens - 输出 Token 数
 */

/**
 * 消息内容（文本格式）
 * @typedef {string} MessageContentText
 */

/**
 * 消息内容（多部分格式）
 * @typedef {Array<MessageContentPart>} MessageContentMulti
 */

/**
 * 消息内容部分
 * @typedef {Object} MessageContentPart
 * @property {'text'|'image'|'tool_use'|'tool_result'} type - 内容类型
 * @property {string} [text] - 文本内容
 * @property {Object} [source] - 图片源（用于图片类型）
 * @property {string} [toolUseId] - 工具使用 ID
 * @property {string} [toolName] - 工具名称
 * @property {Object} [toolInput] - 工具输入
 */

/**
 * 消息列表结果
 * @typedef {Object} MessagesResult
 * @property {Array<SessionMessage>} messages - 消息列表
 * @property {number} total - 总消息数
 * @property {boolean} hasMore - 是否有更多数据
 * @property {number} offset - 当前偏移量
 * @property {number} limit - 每页数量限制
 */

/**
 * 消息过滤选项
 * @typedef {Object} MessageFilterOptions
 * @property {string} [role] - 按角色过滤
 * @property {string} [type] - 按类型过滤
 * @property {Date} [startDate] - 开始日期
 * @property {Date} [endDate] - 结束日期
 * @property {boolean} [includeSystemMessages=false] - 是否包含系统消息
 * @property {boolean} [includeApiErrors=false] - 是否包含 API 错误消息
 */

/**
 * 消息分组
 * @typedef {Object} MessageGroup
 * @property {string} groupId - 分组 ID
 * @property {Array<SessionMessage>} messages - 分组中的消息
 * @property {string} summary - 分组摘要
 * @property {Date} startTime - 开始时间
 * @property {Date} endTime - 结束时间
 */

/**
 * 消息统计
 * @typedef {Object} MessageStats
 * @property {number} totalCount - 总消息数
 * @property {number} userMessageCount - 用户消息数
 * @property {number} assistantMessageCount - 助手消息数
 * @property {number} systemMessageCount - 系统消息数
 * @property {number} totalTokens - 总 Token 使用量
 * @property {number} averageTokensPerMessage - 平均每条消息的 Token 数
 * @property {Date} firstMessageTime - 第一条消息时间
 * @property {Date} lastMessageTime - 最后一条消息时间
 */

/**
 * 导出常量
 */
export const MESSAGE_CONSTANTS = {
  /** 默认消息列表限制 */
  DEFAULT_MESSAGE_LIMIT: 50,
  /** 最大消息列表限制 */
  MAX_MESSAGE_LIMIT: 500,
  /** 默认分页偏移量 */
  DEFAULT_OFFSET: 0,
  /** 系统消息前缀列表 */
  SYSTEM_MESSAGE_PREFIXES: [
    '<command-name>',
    '<command-message>',
    '<command-args>',
    '<local-command-stdout>',
    '<system-reminder>',
    'Caveat:',
    'This session is being continued from a previous',
    'Invalid API key',
    'Warmup',
  ],
  /** API 错误消息标识 */
  API_ERROR_INDICATORS: [
    '{"subtasks":',
    'CRITICAL: You MUST respond with ONLY a JSON',
  ],
};

/**
 * 消息类型枚举
 */
export const MessageType = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  SUMMARY: 'summary',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  ERROR: 'error',
};

/**
 * 消息角色枚举
 */
export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
};

/**
 * 消息状态枚举
 */
export const MessageStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * 判断是否为系统消息
 * @param {SessionMessage} message - 消息对象
 * @returns {boolean}
 */
export function isSystemMessage(message) {
  if (!message || !message.message) return false;

  let textContent = message.message;
  if (Array.isArray(message.message) && message.message.length > 0) {
    const firstPart = message.message[0];
    if (firstPart.type === 'text') {
      textContent = firstPart.text;
    } else {
      return false;
    }
  }

  if (typeof textContent !== 'string') return false;

  return MESSAGE_CONSTANTS.SYSTEM_MESSAGE_PREFIXES.some(prefix =>
    textContent.startsWith(prefix)
  );
}

/**
 * 判断是否为 API 错误消息
 * @param {SessionMessage} message - 消息对象
 * @returns {boolean}
 */
export function isApiErrorMessage(message) {
  if (!message || !message.isApiErrorMessage) return false;
  return true;
}

/**
 * 提取消息文本内容
 * @param {SessionMessage} message - 消息对象
 * @returns {string|null}
 */
export function extractMessageText(message) {
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
 * 计算消息的 Token 使用量
 * @param {SessionMessage} message - 消息对象
 * @returns {number} Token 总数
 */
export function calculateMessageTokens(message) {
  if (!message.usage) return 0;

  const { input_tokens = 0, cache_creation_input_tokens = 0, cache_read_input_tokens = 0, output_tokens = 0 } = message.usage;
  return input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens;
}

/**
 * 过滤系统消息
 * @param {Array<SessionMessage>} messages - 消息列表
 * @returns {Array<SessionMessage>} 过滤后的消息列表
 */
export function filterSystemMessages(messages) {
  return messages.filter(message => !isSystemMessage(message));
}

/**
 * 过滤 API 错误消息
 * @param {Array<SessionMessage>} messages - 消息列表
 * @returns {Array<SessionMessage>} 过滤后的消息列表
 */
export function filterApiErrorMessages(messages) {
  return messages.filter(message => !isApiErrorMessage(message));
}

export default {
  MESSAGE_CONSTANTS,
  MessageType,
  MessageRole,
  MessageStatus,
  isSystemMessage,
  isApiErrorMessage,
  extractMessageText,
  calculateMessageTokens,
  filterSystemMessages,
  filterApiErrorMessages,
};
