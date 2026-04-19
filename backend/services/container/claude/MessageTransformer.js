import { createLogger, sanitizePreview } from '../../../utils/logger.js';
const logger = createLogger('services/container/claude/MessageTransformer');

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function extractTokenBudget(sdkMessage) {
  if (sdkMessage.type !== 'result' || !sdkMessage.modelUsage) return null;
  const modelData = Object.values(sdkMessage.modelUsage)[0];
  if (!modelData) return null;

  const totalUsed =
    (modelData.inputTokens ?? modelData.cumulativeInputTokens ?? 0) +
    (modelData.outputTokens ?? modelData.cumulativeOutputTokens ?? 0) +
    (modelData.cacheReadInputTokens ?? modelData.cumulativeCacheReadInputTokens ?? 0) +
    (modelData.cacheCreationInputTokens ?? modelData.cumulativeCacheCreationInputTokens ?? 0);
  const contextWindow = parseInt(process.env.CONTEXT_WINDOW) || 200000;

  return { used: totalUsed, total: contextWindow };
}

function extractMessagePreview(sdkMessage) {
  if (!sdkMessage) return null;
  if (typeof sdkMessage.content === 'string') return sdkMessage.content;
  if (Array.isArray(sdkMessage.content)) {
    const textPart = sdkMessage.content.find(p => p.type === 'text' && p.text);
    if (textPart) return textPart.text;
  }
  if (sdkMessage.result && typeof sdkMessage.result === 'string') return sdkMessage.result;
  return null;
}

function sendSessionCreated(sdkMessage, writer, sessionId, state) {
  const isTemporarySession = !sessionId || sessionId.startsWith('temp-');
  if (sdkMessage.session_id && !state.sessionCreatedSent && isTemporarySession) {
    state.sessionCreatedSent = true;
    logger.info({ sessionId, newSessionId: sdkMessage.session_id }, '[MessageTransformer] Sending session-created');
    writer.send({ type: 'session-created', sessionId: sdkMessage.session_id });
    if (writer.setSessionId && typeof writer.setSessionId === 'function') {
      writer.setSessionId(sdkMessage.session_id);
    }
  }
}

function handleSdkMessage(sdkMessage, writer, sessionId) {
  if (sdkMessage.type === 'assistant') {
    const preview = extractMessagePreview(sdkMessage);
    logger.debug({ sessionId, preview: sanitizePreview(preview), totalLength: preview?.length || 0 }, '[MessageTransformer] Sending claude-response, type: assistant');
    logger.info({ sessionId }, '[MessageTransformer] Sending claude-response, type: assistant');
    writer.send({ type: 'claude-response', data: sdkMessage });
    return;
  }

  if (sdkMessage.type === 'result') {
    const tokenBudget = extractTokenBudget(sdkMessage);
    if (tokenBudget) {
      writer.send({ type: 'token-budget', data: tokenBudget });
    }
    const isError = sdkMessage.result && /^(Unknown skill|Error:|Failed:)/i.test(sdkMessage.result);
    if (isError) {
      logger.error({ sessionId, errorResult: sdkMessage.result }, '[MessageTransformer] Sending claude-error from result');
      writer.send({ type: 'claude-error', error: sdkMessage.result });
    }
    return;
  }

  logger.debug({ sessionId, sdkMessageType: sdkMessage.type }, '[MessageTransformer] Sending claude-response');
  writer.send({ type: 'claude-response', data: sdkMessage });
}

export function processOutputLine(line, writer, sessionId, state) {
  const jsonData = tryParseJSON(line);
  if (!jsonData) return;

  if (jsonData.type === 'content' && jsonData.chunk) {
    const sdkMessage = jsonData.chunk;
    sendSessionCreated(sdkMessage, writer, sessionId, state);
    handleSdkMessage(sdkMessage, writer, sessionId);
    return;
  }

  if (jsonData.type === 'done') {
    logger.info({ sessionId }, '[MessageTransformer] Sending claude-complete');
    writer.send({ type: 'claude-complete', sessionId: jsonData.sessionId || sessionId, exitCode: 0 });
    return;
  }

  if (jsonData.type === 'error') {
    logger.error({ sessionId, error: jsonData.error }, '[MessageTransformer] Sending claude-error');
    writer.send({ type: 'claude-error', error: jsonData.error });
  }
}

export function processOutput(output, writer, sessionId, state) {
  const lines = output.split('\n').filter(line => line.trim());
  logger.debug({ sessionId, lineCount: lines.length }, '[MessageTransformer] Processing output lines');
  for (const line of lines) {
    processOutputLine(line, writer, sessionId, state);
  }
}
