/**
 * jsonlHelpers.js
 *
 * JSONL 解析辅助函数 — 提取自 jsonl-parser.js
 *
 * @module core/utils/jsonlHelpers
 */

import { filterMemoryContext } from '../../../utils/memoryUtils.js';

// ─── 过滤配置 ────────────────────────────────────────────

export const SYSTEM_MESSAGE_PREFIXES = [
  '<command-name>', '<command-message>', '<command-args>',
  '<local-command-stdout>', '<system-reminder>',
  'Caveat:', 'This session is being continued from a previous',
  'Invalid API key', 'Warmup',
];

export const API_ERROR_INDICATORS = [
  '{"subtasks":', 'CRITICAL: You MUST respond with ONLY a JSON',
];

// ─── 内部辅助函数 ────────────────────────────────────────

/** @returns {Object} 新会话对象 */
export function createSession(sessionId, cwd = '') {
  return {
    id: sessionId, summary: 'New Session', messageCount: 0,
    lastActivity: new Date(), cwd,
    lastUserMessage: null, lastAssistantMessage: null,
  };
}

/** 从 entry.message 提取文本（兼容两种格式） */
export function extractTextFromEntry(message) {
  if (!message) return null;
  if (message.content !== undefined) {
    return _extractTextContent(message.content);
  }
  return _extractTextContent(message);
}

export function _extractTextContent(messageContent) {
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent) && messageContent.length > 0) {
    const firstPart = messageContent[0];
    if (firstPart.type === 'text') return firstPart.text;
  }
  return null;
}

export function _isSystemMessage(text) {
  return typeof text === 'string' && SYSTEM_MESSAGE_PREFIXES.some(p => text.startsWith(p));
}

export function _isApiErrorMessage(text) {
  return typeof text === 'string' && API_ERROR_INDICATORS.some(i => text.includes(i));
}

export function processUserEntry(session, entry) {
  const rawContent = extractTextFromEntry(entry.message);
  const textContent = filterMemoryContext(rawContent);
  if (textContent && !_isSystemMessage(textContent)) {
    session.lastUserMessage = textContent;
  }
}

export function processAssistantEntry(session, entry, includeApiErrors) {
  if (entry.isApiErrorMessage === true && !includeApiErrors) return;
  const textContent = extractTextFromEntry(entry.message);
  if (textContent && !_isSystemMessage(textContent) && !_isApiErrorMessage(textContent)) {
    session.lastAssistantMessage = textContent;
  }
}
