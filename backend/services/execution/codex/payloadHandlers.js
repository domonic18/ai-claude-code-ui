/**
 * payloadHandlers.js
 *
 * Codex 消息 payload 类型处理器 — 从 messages.js 提取
 *
 * @module services/execution/codex/payloadHandlers
 */

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
 */
function handleMessageItem(entry) {
  const content = entry.payload.content;
  const role = entry.payload.role || 'assistant';
  const textContent = extractText(content);

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
 */
function handleFunctionCallItem(entry) {
  let toolName = entry.payload.name;
  let toolInput = entry.payload.arguments;

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
 */
function handleCustomToolCallItem(entry) {
  const toolName = entry.payload.name || 'custom_tool';
  const input = entry.payload.input || '';

  if (toolName === 'apply_patch') {
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
 */
export const PAYLOAD_HANDLERS = new Map([
  ['message', handleMessageItem],
  ['reasoning', handleReasoningItem],
  ['function_call', handleFunctionCallItem],
  ['function_call_output', handleFunctionCallOutputItem],
  ['custom_tool_call', handleCustomToolCallItem],
  ['custom_tool_call_output', handleCustomToolCallOutputItem],
]);
