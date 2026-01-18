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
    if (sdkMessage.session_id && !state.sessionCreatedSent && !sessionId) {
      state.sessionCreatedSent = true;
      console.log('[MessageTransformer] Sending session-created:', sdkMessage.session_id);
      writer.send({
        type: 'session-created',
        sessionId: sdkMessage.session_id
      });
      
      // 在 writer 上设置会话 ID
      if (writer.setSessionId && typeof writer.setSessionId === 'function') {
        writer.setSessionId(sdkMessage.session_id);
      }
    }
    
    // 发送 claude-response
    console.log('[MessageTransformer] Sending claude-response, type:', sdkMessage.type);
    writer.send({
      type: 'claude-response',
      data: sdkMessage
    });
    
    // 如果是 result 消息，也发送 token-budget
    const tokenBudget = extractTokenBudget(sdkMessage);
    if (tokenBudget) {
      writer.send({
        type: 'token-budget',
        data: tokenBudget
      });
    }
  } 
  // 处理 done 消息
  else if (jsonData.type === 'done') {
    console.log('[MessageTransformer] Sending claude-complete');
    writer.send({
      type: 'claude-complete',
      sessionId: jsonData.sessionId || sessionId,
      exitCode: 0
    });
  } 
  // 处理 error 消息
  else if (jsonData.type === 'error') {
    console.error('[MessageTransformer] Sending claude-error:', jsonData.error);
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
  console.log(`[MessageTransformer] Processing ${lines.length} lines`);
  
  for (const line of lines) {
    processOutputLine(line, writer, sessionId, state);
  }
}

