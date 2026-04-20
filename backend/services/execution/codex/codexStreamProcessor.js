/**
 * codexStreamProcessor.js
 *
 * Codex stream event processor
 *
 * @module services/execution/codex/codexStreamProcessor
 */

import { transformCodexEvent } from './codexTransformers.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/codex/codexStreamProcessor');

/**
 * 通过 WebSocket 或 writer 发送消息的辅助函数
 * @param {WebSocket|object} ws - WebSocket 或响应 writer
 * @param {object} data - 要发送的数据
 */
function sendMessage(ws, data) {
  try {
    if (ws.isSSEStreamWriter || ws.isWebSocketWriter) {
      ws.send(data);
    } else if (typeof ws.send === 'function') {
      ws.send(JSON.stringify(data));
    }
  } catch (error) {
    logger.error('[Codex] Error sending message:', error);
  }
}

/**
 * 发送 token 使用情况
 * @param {WebSocket|object} ws - WebSocket 连接或响应 writer
 * @param {object} usage - Usage data
 * @param {string} sessionId - 会话 ID
 */
function sendTokenUsage(ws, usage, sessionId) {
  const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
  sendMessage(ws, {
    type: 'token-budget',
    data: {
      used: totalTokens,
      total: 200000
    }
  });
}

/**
 * 处理 Codex 流式事件
 * @param {AsyncIterable} streamedTurn - 流式事件迭代器
 * @param {WebSocket|object} ws - WebSocket 连接或响应 writer
 * @param {string} currentSessionId - 当前会话 ID
 * @param {Map} activeCodexSessions - 活动会话映射
 * @returns {Promise<void>}
 */
export async function processStreamEvents(streamedTurn, ws, currentSessionId, activeCodexSessions) {
  for await (const event of streamedTurn.events) {
    // 检查会话是否已中止
    const session = activeCodexSessions.get(currentSessionId);
    if (!session || session.status === 'aborted') {
      break;
    }

    if (event.type === 'item.started' || event.type === 'item.updated') {
      continue;
    }

    const transformed = transformCodexEvent(event);

    sendMessage(ws, {
      type: 'codex-response',
      data: transformed,
      sessionId: currentSessionId
    });

    // 提取并发送 token 使用情况（如果可用，标准化以匹配 Claude 格式）
    if (event.type === 'turn.completed' && event.usage) {
      sendTokenUsage(ws, event.usage, currentSessionId);
    }
  }
}

export { sendMessage };
