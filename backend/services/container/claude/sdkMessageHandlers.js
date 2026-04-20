/**
 * SDK Message Handlers
 *
 * Functions for handling different types of SDK messages
 *
 * @module services/container/claude/sdkMessageHandlers
 */

import { createLogger } from '../../../utils/logger.js';
import { extractTokenBudget, extractMessagePreview, isResultError } from './messageParsingHelpers.js';

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
  logger.info({ sessionId, newSessionId: sdkMessage.session_id }, '[MessageTransformer] Sending session-created');

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
  const preview = extractMessagePreview(sdkMessage);

  logger.debug(
    { sessionId, preview: preview?.substring(0, 100), totalLength: preview?.length || 0 },
    '[MessageTransformer] Sending claude-response, type: assistant'
  );

  logger.info({ sessionId }, '[MessageTransformer] Sending claude-response, type: assistant');

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
    writer.send({ type: 'token-budget', data: tokenBudget });
  }

  if (isResultError(sdkMessage)) {
    logger.error(
      { sessionId, errorResult: sdkMessage.result },
      '[MessageTransformer] Sending claude-error from result'
    );
    writer.send({ type: 'claude-error', error: sdkMessage.result });
  }
}

/**
 * Handles default SDK messages
 * @param {Object} sdkMessage - SDK message object
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 */
export function handleDefaultMessage(sdkMessage, writer, sessionId) {
  logger.debug({ sessionId, sdkMessageType: sdkMessage.type }, '[MessageTransformer] Sending claude-response');
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
