/**
 * SDK Message Handlers
 *
 * Functions for handling different types of SDK messages
 *
 * @module services/container/claude/sdkMessageHandlers
 */

import { createLogger } from '../../../utils/logger.js';
import { extractTokenBudget, extractMessageContext, isResultError } from './messageParsingHelpers.js';
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

  // 为真实 session ID 创建别名，使前端用真实 ID 查找 stdin writer 时能找到
  aliasSessionId(sdkMessage.session_id, sessionId);

  writer.send({ type: 'session-created', sessionId: sdkMessage.session_id });

  if (writer.setSessionId && typeof writer.setSessionId === 'function') {
    writer.setSessionId(sdkMessage.session_id);
  }
}

/**
 * Handles assistant-type SDK messages
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 */
export function handleAssistantMessage(sdkMessage, writer, sessionId) {
  const ctx = extractMessageContext(sdkMessage);

  const logPayload = {
    sessionId,
    contentType: ctx.contentType,
    stopReason: ctx.stopReason,
    summary: ctx.summary?.substring(0, 100) || null,
  };
  if (ctx.tools.length > 0) {
    logPayload.tools = ctx.tools.map(t => t.name || (typeof t.result === 'string' ? t.result.substring(0, 80) : t.result));
  }

  logger.info(logPayload, '[MessageTransformer] Sending claude-response, type: assistant');

  writer.send({ type: 'claude-response', data: sdkMessage });
}

/**
 * Handles result-type SDK messages
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 */
export function handleResultMessage(sdkMessage, writer, sessionId) {
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
 * Handles default SDK messages
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 */
export function handleDefaultMessage(sdkMessage, writer, sessionId) {
  const ctx = extractMessageContext(sdkMessage);
  // For system/user messages, include subtype for better identification
  const logPayload = {
    sessionId,
    sdkMessageType: sdkMessage.type,
    contentType: ctx.contentType,
    summary: ctx.summary?.substring(0, 80),
  };
  if (sdkMessage.subtype) {
    logPayload.subtype = sdkMessage.subtype;
  }
  logger.info(
    logPayload,
    '[MessageTransformer] Sending claude-response, type: default'
  );
  writer.send({ type: 'claude-response', data: sdkMessage });
}

/**
 * Message type handler lookup table
 */
const MESSAGE_HANDLERS = {
  assistant: handleAssistantMessage,
  result: handleResultMessage
};

/**
 * Routes SDK message to appropriate handler based on type
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 */
export function handleSdkMessage(sdkMessage, writer, sessionId) {
  const handler = MESSAGE_HANDLERS[sdkMessage.type];

  if (handler) {
    handler(sdkMessage, writer, sessionId);
  } else {
    handleDefaultMessage(sdkMessage, writer, sessionId);
  }
}
