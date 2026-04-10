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

/**
 * Interface for tool result data
 */
interface ToolResultData {
  content: string | any;
  isError: boolean;
  timestamp: Date;
  toolUseResult: any;
}

/**
 * 剥离工具结果中的 base64 图片数据
 *
 * 当 tool_result 的 content 是数组且包含 base64 图片时，
 * 将图片替换为文本占位标记，防止 localStorage 溢出。
 *
 * @param content - tool_result 的原始 content
 * @returns 处理后的 content（base64 图片替换为文本标记）
 */
function stripBase64FromToolResultContent(content: any): any {
  // 处理数组格式的 content（包含 image 对象）
  if (Array.isArray(content)) {
    const hasImageData = content.some(
      (item: any) => item.type === 'image' && item.source?.type === 'base64' && item.source?.data
    );
    if (hasImageData) {
      return content.map((item: any) => {
        if (item.type === 'image' && item.source?.type === 'base64' && item.source?.data) {
          const mediaType = item.source.media_type || 'image/png';
          const dataLength = item.source.data.length;
          return {
            type: 'text',
            text: `[图片: ${mediaType}, ${(dataLength / 1024).toFixed(0)}KB - 历史加载时已省略]`
          };
        }
        return item;
      });
    }
  }

  // 处理字符串格式中可能内嵌的 base64 图片数据
  if (typeof content === 'string') {
    // 检测是否包含 base64 图片数据（data:image/...;base64,... 格式）
    const base64ImagePattern = /data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]{100,}/g;
    if (base64ImagePattern.test(content)) {
      return content.replace(base64ImagePattern, (match) => {
        const mimeMatch = match.match(/data:(image\/[a-zA-Z+]+)/);
        const mediaType = mimeMatch ? mimeMatch[1] : 'image/*';
        const sizeKB = Math.round(match.length / 1024);
        return `[图片: ${mediaType}, ${sizeKB}KB - 历史加载时已省略]`;
      });
    }
  }

  return content;
}

/**
 * Convert raw session messages from API to ChatMessage format
 *
 * This function implements a two-pass conversion strategy:
 * 1. First pass: Collect all tool results from user messages
 * 2. Second pass: Process messages and attach tool results to tool uses
 *
 * @param rawMessages - Raw messages from API with format {message: {role, content}}
 * @returns Array of ChatMessage objects ready for display
 */
export function convertSessionMessages(rawMessages: any[]): ChatMessage[] {
  const converted: ChatMessage[] = [];
  const toolResults = new Map<string, ToolResultData>();

  // First pass: collect all tool results (strip base64 images to prevent localStorage overflow)
  for (const msg of rawMessages) {
    if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
      for (const part of msg.message.content) {
        if (part.type === 'tool_result') {
          toolResults.set(part.tool_use_id, {
            content: stripBase64FromToolResultContent(part.content),
            isError: part.is_error || false,
            timestamp: new Date(msg.timestamp || Date.now()),
            toolUseResult: msg.toolUseResult || null
          });
        }
      }
    }
  }

  // Second pass: process messages and attach tool results to tool uses
  for (const msg of rawMessages) {
    // Handle user messages
    if (msg.message?.role === 'user' && msg.message?.content) {
      let content = '';
      let messageType: ChatMessage['type'] = 'user';

      if (Array.isArray(msg.message.content)) {
        // Handle array content, but skip tool results (they're attached to tool uses)
        const textParts: string[] = [];

        for (const part of msg.message.content) {
          if (part.type === 'text') {
            textParts.push(decodeHtmlEntities(part.text));
          }
          // Skip tool_result parts - they're handled in the first pass
        }

        content = textParts.join('\n');
      } else if (typeof msg.message.content === 'string') {
        content = decodeHtmlEntities(msg.message.content);
      } else {
        content = decodeHtmlEntities(String(msg.message.content));
      }

      // Check if content is a skill system prompt (should be hidden from users)
      // These are SDK-internal messages that should not be displayed to users

      // Pattern 1: Skill directory message - SDK generated
      // "Base directory for this skill: /workspace/.claude/skills/..."
      const isSkillDirectoryMessage = content.includes('Base directory for this skill:') ||
        (content.includes('/.claude/skills/') && content.includes('# '));

      // Pattern 2: YAML frontmatter with skill metadata
      // Matches skill definition files starting with "---" containing name/description/tools
      const isSkillYamlPrompt = content.startsWith('---') &&
        content.includes('name:') &&
        content.includes('description:') &&
        content.includes('tools:');

      // Pattern 3: Multi-pattern skill instruction detection
      // Must match at least 2 of these indicators to avoid false positives:
      const skillIndicators = [
        '## 角色设定', '## 任务目标', '## 工作流程',
        '## 何时使用此工作流', '## 标准评估报告模板',
        'Base directory for this skill'
      ];
      const indicatorCount = skillIndicators.filter(indicator => content.includes(indicator)).length;
      const isSkillInstructionMessage = indicatorCount >= 2 && content.length > 1000;

      const isSkillSystemPrompt = isSkillDirectoryMessage || isSkillYamlPrompt || isSkillInstructionMessage;

      // Skip command messages, system messages, skill prompts, and empty content
      const shouldSkip = !content ||
        content.startsWith('<command-name>') ||
        content.startsWith('<command-message>') ||
        content.startsWith('<command-args>') ||
        content.startsWith('<local-command-stdout>') ||
        content.startsWith('<system-reminder>') ||
        content.startsWith('Caveat:') ||
        content.startsWith('This session is being continued from a previous') ||
        content.startsWith('[Request interrupted') ||
        isSkillSystemPrompt;

      if (!shouldSkip) {
        // Unescape with math formula protection
        content = unescapeWithMathProtection(content);
        converted.push({
          id: msg.id || `msg-${Date.now()}-${Math.random()}`,
          type: messageType,
          content: content,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }
    }

    // Handle thinking messages (Codex reasoning)
    else if (msg.type === 'thinking' && msg.message?.content) {
      converted.push({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        type: 'assistant',
        content: unescapeWithMathProtection(msg.message.content),
        timestamp: msg.timestamp || new Date().toISOString(),
        isThinking: true
      });
    }

    // Handle tool_use messages (Codex function calls)
    else if (msg.type === 'tool_use' && msg.toolName) {
      converted.push({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        type: 'assistant',
        content: '',
        timestamp: msg.timestamp || new Date().toISOString(),
        isToolUse: true,
        toolName: msg.toolName,
        toolInput: msg.toolInput || '',
        toolCallId: msg.toolCallId
      });
    }

    // Handle tool_result messages (Codex function outputs)
    else if (msg.type === 'tool_result') {
      // Find the matching tool_use by callId, or the last tool_use without a result
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

    // Handle assistant messages
    else if (msg.message?.role === 'assistant' && msg.message?.content) {
      if (Array.isArray(msg.message.content)) {
        for (const part of msg.message.content) {
          if (part.type === 'text') {
            // Unescape with math formula protection
            let text = part.text;
            if (typeof text === 'string') {
              text = unescapeWithMathProtection(text);
            }
            converted.push({
              id: msg.id || `msg-${Date.now()}-${Math.random()}`,
              type: 'assistant',
              content: text,
              timestamp: msg.timestamp || new Date().toISOString()
            });
          } else if (part.type === 'tool_use') {
            // Get the corresponding tool result
            const toolResult = toolResults.get(part.id);

            converted.push({
              id: msg.id || `msg-${Date.now()}-${Math.random()}`,
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
            });
          }
        }
      } else if (typeof msg.message.content === 'string') {
        // Unescape with math formula protection
        let text = msg.message.content;
        text = unescapeWithMathProtection(text);
        converted.push({
          id: msg.id || `msg-${Date.now()}-${Math.random()}`,
          type: 'assistant',
          content: text,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }
    }
  }

  return converted;
}
