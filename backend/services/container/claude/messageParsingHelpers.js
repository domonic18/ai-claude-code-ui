/**
 * Message Parsing Helpers
 *
 * Helper functions for parsing SDK messages and extracting metadata
 * including tool inputs, results, and structured context summaries.
 *
 * @module services/container/claude/messageParsingHelpers
 */

export function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

export { extractTokenBudget, isResultError } from './messageBudgetHelpers.js';

const TOOL_INPUT_EXTRACTORS = {
  Bash: (input) => ({ command: truncate(input.command, 200) }),
  Write: (input) => ({ file: input.file_path || input.path }),
  Read: (input) => ({ file: input.file_path || input.path }),
  Edit: (input) => ({ file: input.file_path }),
  MultiEdit: (input) => ({ file: input.file_path }),
  Glob: (input) => ({ pattern: input.pattern, path: input.path }),
  Grep: (input) => ({ pattern: input.pattern, glob: input.glob }),
  Task: (input) => ({
    agent: input.subagent_type || 'unknown',
    description: truncate(input.description, 100)
  }),
  Skill: (input) => ({ skill: input.skill || input.name }),
  TodoWrite: (input) => ({ tasks: Array.isArray(input.todos) ? input.todos.length : 0 }),
  NotebookEdit: (input) => ({ notebook: input.notebook_path }),
  WebSearch: (input) => ({ query: truncate(input.query, 100) }),
  TodoRead: () => ({}),
  LS: (input) => ({ path: input.path }),
};

function truncate(str, maxLen) {
  if (!str || typeof str !== 'string') return str;
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function extractToolInput(toolName, input) {
  if (!input || typeof input !== 'object') return {};
  const extractor = TOOL_INPUT_EXTRACTORS[toolName];
  if (extractor) {
    try { return extractor(input); } catch { return {}; }
  }
  try {
    return { input: truncate(JSON.stringify(input), 150) };
  } catch {
    return {};
  }
}

function resolveContent(sdkMessage) {
  if (sdkMessage.content !== undefined) return sdkMessage.content;
  if (sdkMessage.message?.content !== undefined) return sdkMessage.message.content;
  return null;
}

/**
 * @param {Object} sdkMessage
 * @returns {string|null}
 */
export function extractMessagePreview(sdkMessage) {
  if (!sdkMessage) return null;
  const content = resolveContent(sdkMessage);
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find(p => p.type === 'text' && p.text);
    if (textPart) return textPart.text;
  }
  if (sdkMessage.result && typeof sdkMessage.result === 'string') return sdkMessage.result;
  return null;
}

/**
 * Extracts structured context from an SDK assistant message for logging.
 *
 * @param {Object} sdkMessage - SDK message object
 * @returns {Object} Context with contentType, summary, tools (with inputs), stopReason
 */
export function extractMessageContext(sdkMessage) {
  const ctx = { contentType: 'unknown', summary: null, tools: [], stopReason: null };
  if (!sdkMessage) return ctx;

  ctx.stopReason = sdkMessage.stop_reason || sdkMessage.stopReason
    || sdkMessage.message?.stop_reason || sdkMessage.message?.stopReason || null;

  const content = resolveContent(sdkMessage);

  if (typeof content === 'string') {
    ctx.contentType = 'text';
    ctx.summary = content.substring(0, 150);
    return ctx;
  }

  if (sdkMessage.result && typeof sdkMessage.result === 'string') {
    ctx.contentType = 'result';
    ctx.summary = sdkMessage.result.substring(0, 120);
    return ctx;
  }

  if (Array.isArray(content)) {
    const textParts = [];
    const toolParts = [];

    for (const part of content) {
      if (part.type === 'text' && part.text) {
        textParts.push(part.text);
      } else if (part.type === 'tool_use') {
        const toolInfo = { name: part.name, id: part.id?.substring(0, 8) };
        const inputInfo = extractToolInput(part.name, part.input);
        if (Object.keys(inputInfo).length > 0) {
          toolInfo.input = inputInfo;
        }
        toolParts.push(toolInfo);
      } else if (part.type === 'tool_result') {
        toolParts.push({
          result: 'tool_result',
          id: (part.tool_use_id || part.id || '').substring(0, 8),
          isError: part.is_error || false
        });
      }
    }

    if (toolParts.length > 0) {
      ctx.contentType = 'tool_use';
      ctx.tools = toolParts;
      if (textParts.length > 0) {
        ctx.summary = textParts.join('').substring(0, 100);
      }
    } else if (textParts.length > 0) {
      ctx.contentType = 'text';
      ctx.summary = textParts.join('').substring(0, 150);
    }
  }

  return ctx;
}

/**
 * Extracts a result summary from a tool_result content block.
 *
 * @param {Object} sdkMessage - SDK message containing tool_result blocks
 * @returns {{ toolName: string|null, isError: boolean, resultPreview: string }[]}
 */
export function extractToolResults(sdkMessage) {
  const results = [];
  const content = resolveContent(sdkMessage);

  if (!Array.isArray(content)) return results;

  for (const part of content) {
    if (part.type === 'tool_result') {
      let preview = '';
      if (typeof part.content === 'string') {
        preview = truncate(part.content, 200);
      } else if (Array.isArray(part.content)) {
        const texts = part.content
          .filter(p => p.type === 'text' && p.text)
          .map(p => p.text);
        if (texts.length > 0) preview = truncate(texts.join('\n'), 200);
      }
      results.push({
        toolUseId: (part.tool_use_id || part.id || '').substring(0, 8),
        isError: part.is_error || false,
        resultPreview: preview || null
      });
    }
  }
  return results;
}
