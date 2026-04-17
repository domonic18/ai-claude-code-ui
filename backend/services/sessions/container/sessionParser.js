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
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          entries.push(entry);

          // Handle summary entries
          if (entry.type === 'summary' && entry.summary && !entry.sessionId && entry.leafUuid) {
            pendingSummaries.set(entry.leafUuid, entry.summary);
          }

          if (entry.sessionId) {
            if (!sessions.has(entry.sessionId)) {
              sessions.set(entry.sessionId, {
                id: entry.sessionId,
                summary: 'New Session',
                messageCount: 0,
                lastActivity: new Date(),
                cwd: entry.cwd || '',
                lastUserMessage: null,
                lastAssistantMessage: null
              });
            }

            const session = sessions.get(entry.sessionId);

            // Apply pending summary
            if (session.summary === 'New Session' && entry.parentUuid && pendingSummaries.has(entry.parentUuid)) {
              session.summary = pendingSummaries.get(entry.parentUuid);
            }

            // Update summary from summary entries
            if (entry.type === 'summary' && entry.summary) {
              session.summary = entry.summary;
            }

            // Track user messages
            if (entry.message?.role === 'user' && entry.message?.content) {
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
            } else if (entry.message?.role === 'assistant' && entry.message?.content) {
              if (entry.isApiErrorMessage === true) {
                // Skip API error messages
              } else {
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
            }

            session.messageCount++;

            if (entry.timestamp) {
              session.lastActivity = new Date(entry.timestamp);
            }
          }
        } catch (parseError) {
          // Skip malformed lines
        }
      }
    }

    // Set final summary based on last message if no summary exists
    for (const session of sessions.values()) {
      if (session.summary === 'New Session') {
        const lastMessage = session.lastUserMessage || session.lastAssistantMessage;
        if (lastMessage) {
          session.summary = lastMessage.length > 50 ? lastMessage.substring(0, 50) + '...' : lastMessage;
        }
      }
    }

    // 过滤出 JSON 响应错误（Task Master 错误）
    const allSessions = Array.from(sessions.values());
    const filteredSessions = allSessions.filter(session => {
      const shouldFilter = session.summary.startsWith('{ "');
      return !shouldFilter;
    });

    return {
      sessions: filteredSessions,
      entries: entries
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
