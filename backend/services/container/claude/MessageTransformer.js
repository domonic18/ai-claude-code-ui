import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/container/claude/MessageTransformer');

/**
 * Claude SDK 消息转换器
 * 
 * 负责将容器内 SDK 输出转换为前端期望的 WebSocket 消息格式。
 */

/**
 * 尝试解析 JSON，如果无效则返回 null
 * @param {string} str - 要解析的字符串
 * @returns {object|null} 解析的对象或 null
 */
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * 提取 token 使用信息
 * @param {object} sdkMessage - SDK result 消息
 * @returns {object|null} token-budget 数据或 null
 */
function extractTokenBudget(sdkMessage) {
  if (sdkMessage.type !== 'result' || !sdkMessage.modelUsage) {
    return null;
  }

  const modelKey = Object.keys(sdkMessage.modelUsage)[0];
  const modelData = sdkMessage.modelUsage[modelKey];

  if (!modelData) {
    return null;
  }

  // 计算总使用的 token 数量
  const inputTokens = modelData.inputTokens || modelData.cumulativeInputTokens || 0;
  const outputTokens = modelData.outputTokens || modelData.cumulativeOutputTokens || 0;
  const cacheReadTokens = modelData.cacheReadInputTokens || modelData.cumulativeCacheReadInputTokens || 0;
  const cacheCreationTokens = modelData.cacheCreationInputTokens || modelData.cumulativeCacheCreationInputTokens || 0;

  const totalUsed = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
  const contextWindow = parseInt(process.env.CONTEXT_WINDOW) || 200000;

  // 返回前端期望的格式
  return {
    used: totalUsed,
    total: contextWindow
  };
}

/**
 * 处理单行输出并通过 writer 发送
 * @param {string} line - 输出行
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @param {object} state - 状态对象 { sessionCreatedSent }
 */
export function processOutputLine(line, writer, sessionId, state) {
  const jsonData = tryParseJSON(line);
  
  if (!jsonData) {
    return;
  }
  
  // 处理包装的 SDK 消息
  if (jsonData.type === 'content' && jsonData.chunk) {
    const sdkMessage = jsonData.chunk;
    
    // 从第一条消息捕获并发送 session-created
    // 条件：SDK 返回了 session_id，且尚未发送过，且传入的 sessionId 是临时 ID 或为空
    const isTemporarySession = !sessionId || sessionId.startsWith('temp-');
    if (sdkMessage.session_id && !state.sessionCreatedSent && isTemporarySession) {
      state.sessionCreatedSent = true;
      logger.info('[MessageTransformer] Sending session-created:', sdkMessage.session_id);
      writer.send({
        type: 'session-created',
        sessionId: sdkMessage.session_id
      });
      
      // 在 writer 上设置会话 ID
      if (writer.setSessionId && typeof writer.setSessionId === 'function') {
        writer.setSessionId(sdkMessage.session_id);
      }
    }
    
    // 根据 sdkMessage 类型分别处理，避免 result 消息重复发送内容
    if (sdkMessage.type === 'assistant') {
      // assistant 消息：发送完整的响应内容
      logger.info('[MessageTransformer] Sending claude-response, type: assistant');
      writer.send({
        type: 'claude-response',
        data: sdkMessage
      });
    } else if (sdkMessage.type === 'result') {
      // result 消息：只发送 token-budget，不发送内容（避免与 assistant 消息重复）
      const tokenBudget = extractTokenBudget(sdkMessage);
      if (tokenBudget) {
        writer.send({
          type: 'token-budget',
          data: tokenBudget
        });
      }

      // 检查是否是错误信息（如 "Unknown skill"）
      // 使用更严格的模式，避免误判正常对话中的 "error" 关键词
      const isError = sdkMessage.result &&
        /^(Unknown skill|Error:|Failed:)/i.test(sdkMessage.result);
      if (isError) {
        logger.error('[MessageTransformer] Sending claude-error from result:', sdkMessage.result);
        writer.send({
          type: 'claude-error',
          error: sdkMessage.result
        });
      }
    } else {
      // 其他类型（system、thinking 等）：发送 claude-response
      logger.info('[MessageTransformer] Sending claude-response, type:', sdkMessage.type);
      writer.send({
        type: 'claude-response',
        data: sdkMessage
      });
    }
  } 
  // 处理 done 消息
  else if (jsonData.type === 'done') {
    logger.info('[MessageTransformer] Sending claude-complete');
    writer.send({
      type: 'claude-complete',
      sessionId: jsonData.sessionId || sessionId,
      exitCode: 0
    });
  } 
  // 处理 error 消息
  else if (jsonData.type === 'error') {
    logger.error('[MessageTransformer] Sending claude-error:', jsonData.error);
    writer.send({
      type: 'claude-error',
      error: jsonData.error
    });
  }
}

/**
 * 处理多行输出
 * @param {string} output - 原始输出
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @param {object} state - 状态对象 { sessionCreatedSent }
 */
export function processOutput(output, writer, sessionId, state) {
  const lines = output.split('\n').filter(line => line.trim());
  logger.info(`[MessageTransformer] Processing ${lines.length} lines`);
  
  for (const line of lines) {
    processOutputLine(line, writer, sessionId, state);
  }
}

