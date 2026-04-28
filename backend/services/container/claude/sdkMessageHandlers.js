/**
 * SDK Message Handlers
 *
 * Functions for handling different types of SDK messages.
 * Produces structured logs with tool inputs, results, sequence numbers, and timing.
 *
 * @module services/container/claude/sdkMessageHandlers
 */

import { createLogger } from '../../../utils/logger.js';
import { extractTokenBudget, extractMessageContext, isResultError, extractToolResults } from './messageParsingHelpers.js';
import { aliasSessionId } from './SessionManager.js';

const logger = createLogger('services/container/claude/sdkMessageHandlers');

/**
 * Sends session-created message if conditions are met
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 * @param {Object} state - State object
 */
export function sendSessionCreated(sdkMessage, writer, sessionId, state) {
  const isTemporarySession = !sessionId || sessionId.startsWith('temp-');

  if (!sdkMessage.session_id || state.sessionCreatedSent || !isTemporarySession) {
    return;
  }

  state.sessionCreatedSent = true;
  state.realSessionId = sdkMessage.session_id;
  logger.info({ sessionId, newSessionId: sdkMessage.session_id }, '[MessageTransformer] Sending session-created');

  aliasSessionId(sdkMessage.session_id, sessionId);

  writer.send({ type: 'session-created', sessionId: sdkMessage.session_id });

  if (writer.setSessionId && typeof writer.setSessionId === 'function') {
    writer.setSessionId(sdkMessage.session_id);
  }
}

function buildToolLogMsg(tool, seq) {
  const parts = [`[Tool #${seq}] ${tool.name}`];
  if (tool.input) {
    for (const [key, val] of Object.entries(tool.input)) {
      if (val !== undefined && val !== null && val !== '') {
        parts.push(`${key}=${JSON.stringify(val)}`);
      }
    }
  }
  return parts.join('  ');
}

/**
 * Handles assistant-type SDK messages
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 * @param {Object} state - State object with toolSeq counter and toolTimers map
 */
export function handleAssistantMessage(sdkMessage, writer, sessionId, state) {
  const ctx = extractMessageContext(sdkMessage);

  if (ctx.contentType === 'text' && ctx.summary) {
    logger.info(
      { sessionId, contentType: 'text', summary: ctx.summary },
      `[Assistant] ${ctx.summary}`
    );
  } else if (ctx.tools.length > 0) {
    for (const tool of ctx.tools) {
      if (tool.result === 'tool_result') continue;

      if (!state) continue;
      state.toolSeq = (state.toolSeq || 0) + 1;
      if (!state.toolTimers) state.toolTimers = new Map();
      state.toolTimers.set(tool.id, Date.now());
      if (tool.name && tool.id) {
        if (!state.toolNames) state.toolNames = new Map();
        state.toolNames.set(tool.id, tool.name);
      }

      const logPayload = {
        sessionId,
        toolSeq: state.toolSeq,
        toolName: tool.name,
        ...(tool.input || {})
      };
      const logMsg = buildToolLogMsg(tool, state.toolSeq);
      logger.info(logPayload, logMsg);
    }
  }

  writer.send({ type: 'claude-response', data: sdkMessage });
}

/**
 * Handles result-type SDK messages
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 */
export function handleResultMessage(sdkMessage, writer, sessionId, _state) {
  const tokenBudget = extractTokenBudget(sdkMessage);
  if (tokenBudget) {
    logger.info(
      { sessionId, tokenUsed: tokenBudget.used, tokenTotal: tokenBudget.total, usagePercent: Math.round(tokenBudget.used / tokenBudget.total * 100) },
      '[MessageTransformer] Token budget update'
    );
    writer.send({ type: 'token-budget', data: tokenBudget });
  }

  if (isResultError(sdkMessage)) {
    logger.error(
      { sessionId, errorResult: sdkMessage.result?.substring(0, 200) },
      '[MessageTransformer] Sending claude-error from result'
    );
    writer.send({ type: 'claude-error', error: sdkMessage.result });
  } else {
    logger.info(
      { sessionId, resultPreview: sdkMessage.result?.substring(0, 120) },
      '[MessageTransformer] Sending claude-response, type: result'
    );
  }
}

/**
 * Handles default SDK messages (user/system types including tool_result)
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 * @param {Object} state - State object with toolSeq counter and toolTimers map
 */
export function handleDefaultMessage(sdkMessage, writer, sessionId, state) {
  const ctx = extractMessageContext(sdkMessage);

  const toolResults = extractToolResults(sdkMessage);
  if (toolResults.length > 0 && state) {
    if (!state.toolTimers) state.toolTimers = new Map();
    for (const tr of toolResults) {
      const startTime = state.toolTimers.get(tr.toolUseId);
      const durationMs = startTime ? Date.now() - startTime : null;
      if (startTime) state.toolTimers.delete(tr.toolUseId);

      const toolName = state.toolNames?.get(tr.toolUseId) || 'unknown';
      if (state.toolNames?.has(tr.toolUseId)) state.toolNames.delete(tr.toolUseId);

      const logPayload = {
        sessionId,
        toolName,
        toolUseId: tr.toolUseId,
        isError: tr.isError,
        durationMs
      };
      if (tr.resultPreview) {
        logPayload.resultPreview = tr.resultPreview;
      }

      const durationStr = durationMs !== null ? `  ${durationMs >= 1000 ? (durationMs / 1000).toFixed(1) + 's' : durationMs + 'ms'}` : '';
      const statusStr = tr.isError ? '  FAILED' : '  ok';
      logger.info(logPayload, `[ToolResult]  ${toolName}${statusStr}${durationStr}  ${(tr.resultPreview || '').substring(0, 100)}`);
    }
  } else {
    logger.debug(
      { sessionId, sdkMessageType: sdkMessage.type, contentType: ctx.contentType },
      '[MessageTransformer] Sending claude-response, type: default'
    );
  }

  writer.send({ type: 'claude-response', data: sdkMessage });
}

const MESSAGE_HANDLERS = {
  assistant: handleAssistantMessage,
  result: handleResultMessage
};

/**
 * Routes SDK message to appropriate handler based on type
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 * @param {Object} state - State object
 */
export function handleSdkMessage(sdkMessage, writer, sessionId, state) {
  const handler = MESSAGE_HANDLERS[sdkMessage.type];

  if (handler) {
    handler(sdkMessage, writer, sessionId, state);
  } else {
    handleDefaultMessage(sdkMessage, writer, sessionId, state);
  }
}
