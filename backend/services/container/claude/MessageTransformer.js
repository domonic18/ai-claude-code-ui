/**
 * MessageTransformer.js
 *
 * Transforms container output messages into WebSocket messages
 * Delegates parsing and handling logic to helper modules
 *
 * @module services/container/claude/MessageTransformer
 */

import { createLogger } from '../../../utils/logger.js';
import { tryParseJSON } from './messageParsingHelpers.js';
import { sendSessionCreated, handleSdkMessage } from './sdkMessageHandlers.js';

const logger = createLogger('services/container/claude/MessageTransformer');

/**
 * Processes a single output line and sends appropriate WebSocket messages
 * @param {string} line - Output line to process
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 * @param {Object} state - State object
 */
export function processOutputLine(line, writer, sessionId, state) {
  const jsonData = tryParseJSON(line);
  if (!jsonData) return;

  if (jsonData.type === 'content' && jsonData.chunk) {
    const sdkMessage = jsonData.chunk;
    sendSessionCreated(sdkMessage, writer, sessionId, state);
    handleSdkMessage(sdkMessage, writer, sessionId, state);
    return;
  }

  if (jsonData.type === 'done') {
    logger.info({ sessionId }, '[MessageTransformer] Sending claude-complete');
    writer.send({
      type: 'claude-complete',
      sessionId: jsonData.sessionId || sessionId,
      exitCode: 0
    });
    return;
  }

  if (jsonData.type === 'error') {
    logger.error({ sessionId, error: jsonData.error }, '[MessageTransformer] Sending claude-error');
    writer.send({ type: 'claude-error', error: jsonData.error });
    return;
  }

  // 处理 Agent 交互提问：SDK canUseTool 回调输出的问题消息
  if (jsonData.type === 'agent-question') {
    // 优先使用 SDK 返回的真实 session ID（前端已经替换了临时 ID）
    const effectiveSessionId = state.realSessionId || sessionId;
    logger.info({ sessionId: effectiveSessionId, toolUseID: jsonData.toolUseID }, '[MessageTransformer] Sending agent-question');
    writer.send({
      type: 'agent-question',
      sessionId: effectiveSessionId,
      data: {
        toolUseID: jsonData.toolUseID,
        questions: jsonData.questions || [],
        prompt: jsonData.prompt || ''
      }
    });
  }
}

/**
 * Processes multi-line output
 * @param {string} output - Output to process
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 * @param {Object} state - State object
 */
export function processOutput(output, writer, sessionId, state) {
  const lines = output.split('\n').filter(line => line.trim());
  logger.debug({ sessionId, lineCount: lines.length }, '[MessageTransformer] Processing output lines');

  for (const line of lines) {
    processOutputLine(line, writer, sessionId, state);
  }
}
