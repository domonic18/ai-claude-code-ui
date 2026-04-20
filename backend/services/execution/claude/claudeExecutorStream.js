/**
 * Claude Executor Stream Processing
 *
 * Stream message processing utilities for Claude executor
 *
 * @module execution/claude/claudeExecutorStream
 */

import { createLogger } from '../../../utils/logger.js';
import { extractTokenBudget } from './claudeExecutorTokens.js';
const logger = createLogger('services/execution/claude/claudeExecutorStream');

/**
 * Processes stream messages from SDK query
 * @param {Object} queryInstance - SDK query instance
 * @param {string} capturedSessionId - Captured session ID
 * @param {string} originalSessionId - Original session ID
 * @param {Object} writer - WebSocket writer
 * @param {Function} addSession - Function to add session
 * @param {Function} handleNewSession - Function to handle new session
 * @returns {Promise<string>} Final captured session ID
 */
export async function processStreamMessages(queryInstance, capturedSessionId, originalSessionId, writer, addSession, handleNewSession) {
  logger.info({ sessionId: capturedSessionId || 'NEW' }, '[ClaudeExecutor] Starting async generator loop');

  for await (const message of queryInstance) {
    // Capture session ID from first message
    if (message.session_id && !capturedSessionId) {
      capturedSessionId = message.session_id;
      addSession(capturedSessionId, queryInstance, [], null);
      await handleNewSession(capturedSessionId, originalSessionId, writer);
    }

    // Transform and send message to WebSocket
    writer.send({
      type: 'claude-response',
      data: message
    });

    // Extract and send token budget update from result message
    if (message.type === 'result') {
      const tokenBudget = extractTokenBudget(message);
      if (tokenBudget) {
        logger.info({ sessionId: capturedSessionId, tokenBudget }, '[ClaudeExecutor] Token budget from modelUsage');
        writer.send({
          type: 'token-budget',
          data: tokenBudget
        });
      }
    }
  }

  return capturedSessionId;
}

/**
 * Handles new session creation
 * @param {string} capturedSessionId - Captured session ID
 * @param {string} originalSessionId - Original session ID
 * @param {Object} writer - WebSocket writer
 */
export async function handleNewSession(capturedSessionId, originalSessionId, writer) {
  // Set session ID on writer
  if (writer?.setSessionId && typeof writer.setSessionId === 'function') {
    writer.setSessionId(capturedSessionId);
  }

  // Send session-created event only for new sessions
  if (!originalSessionId) {
    writer.send({
      type: 'session-created',
      sessionId: capturedSessionId
    });
  }
}

/**
 * Sends completion event
 * @param {Object} writer - WebSocket writer
 * @param {string} capturedSessionId - Captured session ID
 * @param {string} originalSessionId - Original session ID
 * @param {string} command - Original command
 */
export function sendCompleteEvent(writer, capturedSessionId, originalSessionId, command) {
  logger.info({ sessionId: capturedSessionId }, '[ClaudeExecutor] Streaming complete');
  writer.send({
    type: 'claude-complete',
    sessionId: capturedSessionId,
    exitCode: 0,
    isNewSession: !originalSessionId && !!command
  });
}

/**
 * Handles execution error
 * @param {Error} error - Error object
 * @param {string} capturedSessionId - Captured session ID
 * @param {Array<string>} tempImagePaths - Temporary image paths
 * @param {string} tempDir - Temporary directory
 * @param {Function} removeSession - Function to remove session
 * @param {Function} cleanupTempFiles - Function to cleanup temp files
 * @param {Object} writer - WebSocket writer
 */
export async function handleExecutionError(error, capturedSessionId, tempImagePaths, tempDir, removeSession, cleanupTempFiles, writer) {
  logger.error({ sessionId: capturedSessionId, err: error }, '[ClaudeExecutor] Execution error');

  // Cleanup session on error
  if (capturedSessionId) {
    removeSession(capturedSessionId);
  }

  // Cleanup temporary image files on error
  await cleanupTempFiles(tempImagePaths, tempDir);

  // Send error to WebSocket
  writer.send({
    type: 'claude-error',
    error: error.message
  });
}
