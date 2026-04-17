/**
 * 会话数据解析模块
 *
 * 解析 JSONL 格式的 Claude Code 会话数据，
 * 提取会话摘要、消息内容，并过滤系统消息和记忆上下文。
 *
 * @module sessions/container/sessionParser
 */

import { filterMemoryContext } from '../../../utils/memoryUtils.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/sessions/container/sessionParser');

/**
 * 判断用户消息是否为系统消息（不应显示给用户）
 * @param {string} text - 消息文本
 * @returns {boolean} 是否为系统消息
 */
function isSystemUserMessage(text) {
  return typeof text === 'string' && (
    text.startsWith('<command-name>') ||
    text.startsWith('<command-message>') ||
    text.startsWith('<command-args>') ||
    text.startsWith('<local-command-stdout>') ||
    text.startsWith('<system-reminder>') ||
    text.startsWith('Caveat:') ||
    text.startsWith('This session is being continued from a previous') ||
    text.startsWith('Invalid API key') ||
    text.includes('{"subtasks":') ||
    text.includes('CRITICAL: You MUST respond with ONLY a JSON') ||
    text === 'Warmup'
  );
}

/**
 * 判断助手消息是否为系统消息
 * @param {string} text - 消息文本
 * @returns {boolean} 是否为系统消息
 */
function isSystemAssistantMessage(text) {
  return typeof text === 'string' && (
    text.startsWith('Invalid API key') ||
    text.includes('{"subtasks":') ||
    text.includes('CRITICAL: You MUST respond with ONLY a JSON')
  );
}

/**
 * 提取消息的文本内容
 * @param {*} content - 消息内容（字符串或数组）
 * @returns {string} 提取的文本
 */
function extractTextContent(content) {
  if (Array.isArray(content) && content.length > 0 && content[0].type === 'text') {
    return content[0].text;
  }
  return content;
}

/**
 * 创建新的会话对象
 * @param {string} sessionId - 会话 ID
 * @param {string} [cwd=''] - 工作目录
 * @returns {Object} 新会话对象
 */
function createSession(sessionId, cwd = '') {
  return {
    id: sessionId,
    summary: 'New Session',
    messageCount: 0,
    lastActivity: new Date(),
    cwd,
    lastUserMessage: null,
    lastAssistantMessage: null
  };
}

/**
 * 从条目中更新会话的用户消息
 * @param {Object} session - 会话对象（可变）
 * @param {Object} entry - JSONL 条目
 */
function updateUserMessage(session, entry) {
  const rawContent = entry.message.content;
  const textContent = extractTextContent(rawContent);

  // 过滤记忆上下文内容
  const filteredTextContent = filterMemoryContext(textContent);
  if (filteredTextContent !== textContent) {
    logger.info('[sessionParser] Filtered memory context from user message');
  }

  if (typeof filteredTextContent === 'string' && filteredTextContent.length > 0 && !isSystemUserMessage(filteredTextContent)) {
    session.lastUserMessage = filteredTextContent;
  }
}

/**
 * 从条目中更新会话的助手消息
 * @param {Object} session - 会话对象（可变）
 * @param {Object} entry - JSONL 条目
 */
function updateAssistantMessage(session, entry) {
  if (entry.isApiErrorMessage === true) {
    return; // Skip API error messages
  }

  let assistantText = null;
  if (Array.isArray(entry.message.content)) {
    for (const part of entry.message.content) {
      if (part.type === 'text' && part.text) {
        assistantText = part.text;
      }
    }
  } else if (typeof entry.message.content === 'string') {
    assistantText = entry.message.content;
  }

  if (assistantText && !isSystemAssistantMessage(assistantText)) {
    session.lastAssistantMessage = assistantText;
  }
}

/**
 * 更新单个条目对应的会话信息
 * @param {Map} sessions - 会话映射（可变）
 * @param {Map} pendingSummaries - 待处理的摘要（可变）
 * @param {Object} entry - JSONL 条目
 */
function updateSessionFromEntry(sessions, pendingSummaries, entry) {
  if (!entry.sessionId) {
    return;
  }

  // 初始化会话
  if (!sessions.has(entry.sessionId)) {
    sessions.set(entry.sessionId, createSession(entry.sessionId, entry.cwd));
  }

  const session = sessions.get(entry.sessionId);

  // 应用待处理的摘要
  if (session.summary === 'New Session' && entry.parentUuid && pendingSummaries.has(entry.parentUuid)) {
    session.summary = pendingSummaries.get(entry.parentUuid);
  }

  // 更新摘要
  if (entry.type === 'summary' && entry.summary) {
    session.summary = entry.summary;
  }

  // 处理消息
  if (entry.message?.role === 'user' && entry.message?.content) {
    updateUserMessage(session, entry);
  } else if (entry.message?.role === 'assistant' && entry.message?.content) {
    updateAssistantMessage(session, entry);
  }

  session.messageCount++;
  if (entry.timestamp) {
    session.lastActivity = new Date(entry.timestamp);
  }
}

/**
 * 完善会话数据：设置最终摘要并过滤无效会话
 * @param {Map} sessions - 会话映射
 * @returns {Array} 过滤后的会话列表
 */
function finalizeSessions(sessions) {
  // 设置最终摘要
  for (const session of sessions.values()) {
    if (session.summary === 'New Session') {
      const lastMessage = session.lastUserMessage || session.lastAssistantMessage;
      if (lastMessage) {
        session.summary = lastMessage.length > 50 ? lastMessage.substring(0, 50) + '...' : lastMessage;
      }
    }
  }

  // 过滤 JSON 响应错误（Task Master 错误）
  return Array.from(sessions.values()).filter(session => !session.summary.startsWith('{ "'));
}

/**
 * 解析 JSONL 文件中的会话数据
 * @param {string} content - JSONL 文件内容
 * @returns {Object} 包含会话和条目的对象 { sessions: Array, entries: Array }
 */
export function parseJsonlContent(content) {
  const sessions = new Map();
  const entries = [];
  const pendingSummaries = new Map();

  try {
    const lines = content.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);
        entries.push(entry);

        // 收集无 sessionId 的 summary 条目
        if (entry.type === 'summary' && entry.summary && !entry.sessionId && entry.leafUuid) {
          pendingSummaries.set(entry.leafUuid, entry.summary);
        }

        // 更新会话信息
        updateSessionFromEntry(sessions, pendingSummaries, entry);
      } catch {
        // Skip malformed lines
      }
    }

    return {
      sessions: finalizeSessions(sessions),
      entries
    };

  } catch (error) {
    logger.error('Error parsing JSONL content:', error);
    return { sessions: [], entries: [] };
  }
}

/**
 * 过滤用户消息中的记忆上下文
 * @param {Object} entry - 消息条目
 * @returns {Object} 过滤后的条目
 */
export function filterMemoryContextFromEntry(entry) {
  if (entry.message?.role === 'user' && entry.message?.content) {
    const content = entry.message.content;
    const textContent = extractTextContent(content);

    // 使用共享函数过滤记忆上下文
    const filteredContent = filterMemoryContext(textContent);

    // 如果内容被修改，返回新的条目
    if (filteredContent !== textContent) {
      return {
        ...entry,
        message: {
          ...entry.message,
          content: filteredContent
        }
      };
    }
  }

  // 不需要过滤，返回原始条目
  return entry;
}
