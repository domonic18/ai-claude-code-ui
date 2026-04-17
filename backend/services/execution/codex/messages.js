/**
 * Codex 消息处理
 *
 * 获取特定 Codex 会话的消息历史
 */

import fsSync from 'fs';
import readline from 'readline';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/execution/codex/messages');

// ─── entry payload type → handler 映射 ─────────────────

/**
 * Helper: extract text from Codex content array
 * @param {Array|any} content
 * @returns {string}
 */
function extractText(content) {
  if (!Array.isArray(content)) return content;
  return content
    .map(item => {
      if (item.type === 'input_text' || item.type === 'output_text' || item.type === 'text') {
        return item.text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * 处理 message 类型的 response_item
 * @param {Object} entry
 * @returns {Object|null}
 */
function handleMessageItem(entry) {
  const content = entry.payload.content;
  const role = entry.payload.role || 'assistant';
  const textContent = extractText(content);

  // Skip system context messages
  if (textContent?.includes('<environment_context>')) return null;
  if (!textContent?.trim()) return null;

  return {
    type: role === 'user' ? 'user' : 'assistant',
    timestamp: entry.timestamp,
    message: { role, content: textContent }
  };
}

/**
 * 处理 reasoning 类型的 response_item
 * @param {Object} entry
 * @returns {Object|null}
 */
function handleReasoningItem(entry) {
  const summaryText = entry.payload.summary
    ?.map(s => s.text)
    .filter(Boolean)
    .join('\n');
  if (!summaryText?.trim()) return null;

  return {
    type: 'thinking',
    timestamp: entry.timestamp,
    message: { role: 'assistant', content: summaryText }
  };
}

/**
 * 处理 function_call 类型的 response_item
 * @param {Object} entry
 * @returns {Object}
 */
function handleFunctionCallItem(entry) {
  let toolName = entry.payload.name;
  let toolInput = entry.payload.arguments;

  // Map Codex tool names to Claude equivalents
  if (toolName === 'shell_command') {
    toolName = 'Bash';
    try {
      const args = JSON.parse(entry.payload.arguments);
      toolInput = JSON.stringify({ command: args.command });
    } catch {
      // Keep original if parsing fails
    }
  }

  return {
    type: 'tool_use',
    timestamp: entry.timestamp,
    toolName,
    toolInput,
    toolCallId: entry.payload.call_id
  };
}

/**
 * 处理 function_call_output 类型的 response_item
 * @param {Object} entry
 * @returns {Object}
 */
function handleFunctionCallOutputItem(entry) {
  return {
    type: 'tool_result',
    timestamp: entry.timestamp,
    toolCallId: entry.payload.call_id,
    output: entry.payload.output
  };
}

/**
 * 处理 custom_tool_call 类型的 response_item（含 apply_patch 特殊逻辑）
 * @param {Object} entry
 * @returns {Object}
 */
function handleCustomToolCallItem(entry) {
  const toolName = entry.payload.name || 'custom_tool';
  const input = entry.payload.input || '';

  if (toolName === 'apply_patch') {
    // Parse Codex patch format and convert to Claude Edit format
    const fileMatch = input.match(/\*\*\* Update File: (.+)/);
    const filePath = fileMatch ? fileMatch[1].trim() : 'unknown';

    const lines = input.split('\n');
    const oldLines = [];
    const newLines = [];

    for (const line of lines) {
      if (line.startsWith('-') && !line.startsWith('---')) {
        oldLines.push(line.substring(1));
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        newLines.push(line.substring(1));
      }
    }

    return {
      type: 'tool_use',
      timestamp: entry.timestamp,
      toolName: 'Edit',
      toolInput: JSON.stringify({
        file_path: filePath,
        old_string: oldLines.join('\n'),
        new_string: newLines.join('\n')
      }),
      toolCallId: entry.payload.call_id
    };
  }

  return {
    type: 'tool_use',
    timestamp: entry.timestamp,
    toolName,
    toolInput: input,
    toolCallId: entry.payload.call_id
  };
}

/**
 * 处理 custom_tool_call_output 类型的 response_item
 * @param {Object} entry
 * @returns {Object}
 */
function handleCustomToolCallOutputItem(entry) {
  return {
    type: 'tool_result',
    timestamp: entry.timestamp,
    toolCallId: entry.payload.call_id,
    output: entry.payload.output || ''
  };
}

/**
 * payload type → handler 映射表
 * @type {Map<string, function(Object): Object|null>}
 */
const PAYLOAD_HANDLERS = new Map([
  ['message', handleMessageItem],
  ['reasoning', handleReasoningItem],
  ['function_call', handleFunctionCallItem],
  ['function_call_output', handleFunctionCallOutputItem],
  ['custom_tool_call', handleCustomToolCallItem],
  ['custom_tool_call_output', handleCustomToolCallOutputItem],
]);

// ─── 主函数 ────────────────────────────────────────────

/**
 * 获取特定 Codex 会话的消息（支持分页）
 * @param {string} sessionId - 会话 ID
 * @param {number|null} limit - 消息数量限制（null 表示返回全部）
 * @param {number} offset - 分页偏移量
 * @returns {Promise<Object>} 消息列表和分页信息
 */
async function getCodexSessionMessages(sessionId, limit = null, offset = 0) {
  try {
    const codexSessionsDir = path.join(os.homedir(), '.codex', 'sessions');

    // Find the session file by searching for the session ID
    const findSessionFile = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = await findSessionFile(fullPath);
            if (found) return found;
          } else if (entry.name.includes(sessionId) && entry.name.endsWith('.jsonl')) {
            return fullPath;
          }
        }
      } catch {
        // Skip directories we can't read
      }
      return null;
    };

    const sessionFilePath = await findSessionFile(codexSessionsDir);

    if (!sessionFilePath) {
      logger.warn(`Codex session file not found for session ${sessionId}`);
      return { messages: [], total: 0, hasMore: false };
    }

    const messages = [];
    let tokenUsage = null;
    const fileStream = fsSync.createReadStream(sessionFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);

        // Extract token usage from token_count events (keep latest)
        if (entry.type === 'event_msg' && entry.payload?.type === 'token_count' && entry.payload?.info) {
          const info = entry.payload.info;
          if (info.total_token_usage) {
            tokenUsage = {
              used: info.total_token_usage.total_tokens || 0,
              total: info.model_context_window || 200000
            };
          }
          continue;
        }

        // Dispatch response_item entries to handlers
        if (entry.type === 'response_item' && entry.payload?.type) {
          const handler = PAYLOAD_HANDLERS.get(entry.payload.type);
          if (handler) {
            const result = handler(entry);
            if (result) messages.push(result);
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Sort by timestamp
    messages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    const total = messages.length;

    // Apply pagination if limit is specified
    if (limit !== null) {
      const startIndex = Math.max(0, total - offset - limit);
      const endIndex = total - offset;
      const paginatedMessages = messages.slice(startIndex, endIndex);
      const hasMore = startIndex > 0;

      return {
        messages: paginatedMessages,
        total,
        hasMore,
        offset,
        limit,
        tokenUsage
      };
    }

    return { messages, tokenUsage };

  } catch (error) {
    logger.error(`Error reading Codex session messages for ${sessionId}:`, error);
    return { messages: [], total: 0, hasMore: false };
  }
}

export {
  getCodexSessionMessages
};
