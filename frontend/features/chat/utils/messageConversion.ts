/**
 * Message Conversion Utilities
 *
 * Provides functions for converting raw API message data into
 * the ChatMessage format used by the chat interface.
 *
 * Handles:
 * - Tool result collection and attachment
 * - HTML entity decoding
 * - Content unescaping with math formula protection
 * - Message filtering (system/internal messages)
 */

import type { ChatMessage } from '../types';

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Unescape \n, \t, \r while protecting LaTeX formulas ($...$ and $$...$$) from being corrupted
 */
export function unescapeWithMathProtection(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const mathBlocks: string[] = [];
  const PLACEHOLDER_PREFIX = '__MATH_BLOCK_';
  const PLACEHOLDER_SUFFIX = '__';

  // Extract and protect math formulas
  let processedText = text.replace(/\$\$([\s\S]*?)\$\$|\$([^\$\n]+?)\$/g, (match) => {
    const index = mathBlocks.length;
    mathBlocks.push(match);
    return `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
  });

  // Process escape sequences on non-math content
  processedText = processedText.replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');

  // Restore math formulas
  processedText = processedText.replace(
    new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, 'g'),
    (match, index) => {
      return mathBlocks[parseInt(index)];
    }
  );

  return processedText;
}

// ─── 辅助类型 ──────────────────────────────────────────

interface ToolResultData {
  content: string | any;
  isError: boolean;
  timestamp: Date;
  toolUseResult: any;
}

/** 生成消息 ID */
function makeMsgId(): string {
  return `msg-${Date.now()}-${Math.random()}`;
}

/** 从 raw message 提取文本内容（处理 string 和 array 两种格式） */
function extractUserContent(content: any): string {
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => decodeHtmlEntities(part.text))
      .join('\n');
  }
  return decodeHtmlEntities(typeof content === 'string' ? content : String(content));
}

// ─── 消息过滤检测 ──────────────────────────────────────

/** Skill system prompt 的多指标检测（至少匹配 2 项才判定） */
const SKILL_INDICATORS = [
  '## 角色设定', '## 任务目标', '## 工作流程',
  '## 何时使用此工作流', '## 标准评估报告模板',
  'Base directory for this skill'
];

/** 需要跳过的命令/系统消息前缀 */
const SKIP_PREFIXES = [
  '<command-name>', '<command-message>', '<command-args>',
  '<local-command-stdout>', '<system-reminder>',
  'Caveat:', 'This session is being continued from a previous',
  '[Request interrupted'
];

/** 判断内容是否为 skill system prompt */
function isSkillSystemPrompt(content: string): boolean {
  if (content.includes('Base directory for this skill:') ||
    (content.includes('/.claude/skills/') && content.includes('# '))) {
    return true;
  }

  if (content.startsWith('---') &&
    content.includes('name:') && content.includes('description:') && content.includes('tools:')) {
    return true;
  }

  const indicatorCount = SKILL_INDICATORS.filter(indicator => content.includes(indicator)).length;
  return indicatorCount >= 2 && content.length > 1000;
}

/** 判断用户消息是否应该被跳过 */
function shouldSkipUserMessage(content: string): boolean {
  if (!content) return true;
  if (SKIP_PREFIXES.some(prefix => content.startsWith(prefix))) return true;
  if (isSkillSystemPrompt(content)) return true;
  return false;
}

// ─── 消息类型处理函数 ──────────────────────────────────

/** 处理 user 消息 */
function processUserMessage(msg: any, converted: ChatMessage[]): void {
  const content = extractUserContent(msg.message.content);
  if (shouldSkipUserMessage(content)) return;

  converted.push({
    id: msg.id || makeMsgId(),
    type: 'user',
    content: unescapeWithMathProtection(content),
    timestamp: msg.timestamp || new Date().toISOString()
  });
}

/** 处理 thinking 消息（Codex reasoning） */
function processThinkingMessage(msg: any, converted: ChatMessage[]): void {
  converted.push({
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: unescapeWithMathProtection(msg.message.content),
    timestamp: msg.timestamp || new Date().toISOString(),
    isThinking: true
  });
}

/** 处理 tool_use 消息（Codex function calls） */
function processToolUseMessage(msg: any, converted: ChatMessage[]): void {
  converted.push({
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: '',
    timestamp: msg.timestamp || new Date().toISOString(),
    isToolUse: true,
    toolName: msg.toolName,
    toolInput: msg.toolInput || '',
    toolCallId: msg.toolCallId
  });
}

/** 处理 tool_result 消息（Codex function outputs） */
function processToolResultMessage(msg: any, converted: ChatMessage[]): void {
  for (let i = converted.length - 1; i >= 0; i--) {
    if (converted[i].isToolUse && !converted[i].toolResult) {
      if (!msg.toolCallId || converted[i].toolCallId === msg.toolCallId) {
        converted[i].toolResult = {
          content: msg.output || '',
          isError: false
        };
        break;
      }
    }
  }
}

/** 从 assistant 消息的 content 数组中提取文本部分 */
function buildTextPart(part: any, msg: any): ChatMessage {
  const text = typeof part.text === 'string'
    ? unescapeWithMathProtection(part.text)
    : part.text;
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: text,
    timestamp: msg.timestamp || new Date().toISOString()
  };
}

/** 从 assistant 消息的 content 数组中提取 tool_use 部分并附加结果 */
function buildToolUsePart(part: any, msg: any, toolResults: Map<string, ToolResultData>): ChatMessage {
  const toolResult = toolResults.get(part.id);
  return {
    id: msg.id || makeMsgId(),
    type: 'assistant',
    content: '',
    timestamp: msg.timestamp || new Date().toISOString(),
    isToolUse: true,
    toolName: part.name,
    toolInput: JSON.stringify(part.input),
    toolResult: toolResult ? {
      content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
      isError: toolResult.isError,
      toolUseResult: toolResult.toolUseResult
    } : null,
    toolError: toolResult?.isError || false,
    toolResultTimestamp: toolResult?.timestamp || new Date()
  };
}

/** 处理 assistant 消息（文本 + tool_use 混合） */
function processAssistantMessage(
  msg: any,
  converted: ChatMessage[],
  toolResults: Map<string, ToolResultData>
): void {
  if (Array.isArray(msg.message.content)) {
    for (const part of msg.message.content) {
      if (part.type === 'text') {
        converted.push(buildTextPart(part, msg));
      } else if (part.type === 'tool_use') {
        converted.push(buildToolUsePart(part, msg, toolResults));
      }
    }
  } else if (typeof msg.message.content === 'string') {
    converted.push({
      id: msg.id || makeMsgId(),
      type: 'assistant',
      content: unescapeWithMathProtection(msg.message.content),
      timestamp: msg.timestamp || new Date().toISOString()
    });
  }
}

// ─── 消息分发注册表 ──────────────────────────────────────

/** 消息类型判断 + 处理的注册条目 */
type MessageDispatcher = {
  match: (msg: any) => boolean;
  handle: (msg: any, converted: ChatMessage[], toolResults: Map<string, ToolResultData>) => void;
};

const MESSAGE_DISPATCHERS: MessageDispatcher[] = [
  { match: (msg) => msg.message?.role === 'user' && msg.message?.content, handle: (msg, out) => processUserMessage(msg, out) },
  { match: (msg) => msg.type === 'thinking' && msg.message?.content, handle: (msg, out) => processThinkingMessage(msg, out) },
  { match: (msg) => msg.type === 'tool_use' && msg.toolName, handle: (msg, out) => processToolUseMessage(msg, out) },
  { match: (msg) => msg.type === 'tool_result', handle: (msg, out) => processToolResultMessage(msg, out) },
  { match: (msg) => msg.message?.role === 'assistant' && msg.message?.content, handle: (msg, out, tr) => processAssistantMessage(msg, out, tr) },
];

// ─── 主转换函数 ────────────────────────────────────────

/**
 * 从原始消息中收集所有 tool_result 数据
 * @param rawMessages - 原始消息数组
 * @returns tool_use_id → ToolResultData 映射
 */
function collectToolResults(rawMessages: any[]): Map<string, ToolResultData> {
  const toolResults = new Map<string, ToolResultData>();

  for (const msg of rawMessages) {
    if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
      for (const part of msg.message.content) {
        if (part.type === 'tool_result') {
          toolResults.set(part.tool_use_id, {
            content: part.content,
            isError: part.is_error || false,
            timestamp: new Date(msg.timestamp || Date.now()),
            toolUseResult: msg.toolUseResult || null
          });
        }
      }
    }
  }

  return toolResults;
}

/**
 * Convert raw session messages from API to ChatMessage format
 *
 * Two-pass strategy:
 * 1. Collect all tool results from user messages
 * 2. Process messages and attach tool results to tool uses
 *
 * @param rawMessages - Raw messages from API with format {message: {role, content}}
 * @returns Array of ChatMessage objects ready for display
 */
export function convertSessionMessages(rawMessages: any[]): ChatMessage[] {
  const converted: ChatMessage[] = [];

  // First pass: collect all tool results
  const toolResults = collectToolResults(rawMessages);

  // Second pass: dispatch to type-specific handlers via registry
  for (const msg of rawMessages) {
    for (const dispatcher of MESSAGE_DISPATCHERS) {
      if (dispatcher.match(msg)) {
        dispatcher.handle(msg, converted, toolResults);
        break;
      }
    }
  }

  return converted;
}
