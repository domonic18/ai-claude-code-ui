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

  // 逐 token 流式：SDK yield 的 stream_event 是 Anthropic 原始 SSE 事件。
  // 为复用前端已有的 handleStreamingDelta(content_block_delta → updateStreamContent)，
  // 把文本/思考增量包装成 claude-response 消息（data = content_block_delta 格式），
  // 而非走独立的 stream-delta 通道。content_block_stop 触发 completeStream 收尾。
  if (jsonData.type === 'stream_event' && jsonData.event) {
    const ev = jsonData.event;
    if (ev.type === 'content_block_delta' && ev.delta) {
      if (typeof ev.delta.text === 'string') {
        if (Array.isArray(state.deltas)) state.deltas.push(Date.now());
        state.textDeltaCount = (state.textDeltaCount || 0) + 1;
        writer.send({
          type: 'claude-response',
          data: { type: 'content_block_delta', delta: { text: ev.delta.text } }
        });
      } else if (typeof ev.delta.thinking === 'string') {
        if (Array.isArray(state.deltas)) state.deltas.push(Date.now());
        state.thinkingDeltaCount = (state.thinkingDeltaCount || 0) + 1;
        writer.send({
          type: 'claude-response',
          data: { type: 'content_block_delta', delta: { thinking: ev.delta.thinking } }
        });
      }
    } else if (ev.type === 'content_block_stop') {
      writer.send({
        type: 'claude-response',
        data: { type: 'content_block_stop' }
      });
    }
    return;
  }

  if (jsonData.type === 'done') {
    logger.info({ sessionId }, '[MessageTransformer] Sending claude-complete');
    writer.send({
      type: 'claude-complete',
      sessionId: jsonData.sessionId || sessionId,
      exitCode: 0
    });
    // 主动通知流处理层：SDK 已输出 done，可以立即结束 docker exec stream。
    // 否则 SDK 进程不主动退出，stream.on('end') 永远不来，导致空挂。
    if (state.onDone) {
      state.onDone();
    }
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

  // bypassPermissions 模式下 AI 尝试提问但已被自动回答（仅日志记录，不转发前端）
  if (jsonData.type === 'agent-question-auto-answered') {
    logger.info(
      { sessionId, toolUseID: jsonData.toolUseID, autoAnswer: jsonData.autoAnswer },
      '[MessageTransformer] Agent question auto-answered (bypassPermissions mode)'
    );
  }
}

/**
 * Processes multi-line output
 *
 * 行缓冲说明：Docker exec 流不保证一行 JSON 在单个 `data` 事件里完整到达，
 * 大体积 SDK 消息（如长文档的 Write/Edit tool_use，单行可达数十 KB）会被
 * 切成多个 `data` 事件。若按 chunk 独立 `split('\n')`，残缺的 JSON 片段会被
 * `tryParseJSON` 静默丢弃，导致 Write 工具调用完全丢失（文档不显示、摘要卡 pending）。
 *
 * 因此在 `state.stdoutBuffer` 上累积未结束的尾巴，拼到下次输入前，只解析
 * 已以 `\n` 结尾的完整行。`state` 由上层每个流新建一次，缓冲天然按流隔离。
 *
 * @param {string} output - Output to process
 * @param {Object} writer - Message writer
 * @param {string} sessionId - Session ID
 * @param {Object} state - State object（持有跨 chunk 的 stdoutBuffer 行缓冲）
 */
export function processOutput(output, writer, sessionId, state) {
  const buffer = (state.stdoutBuffer || '') + output;
  const segments = buffer.split('\n');
  // 最后一段可能不完整（无结尾 \n），留待与下一个 data 事件拼接
  state.stdoutBuffer = segments.pop();
  const lines = segments.filter(line => line.trim());

  logger.debug(
    { sessionId, lineCount: lines.length, hasBuffered: !!state.stdoutBuffer },
    '[MessageTransformer] Processing output lines'
  );

  for (const line of lines) {
    processOutputLine(line, writer, sessionId, state);
  }
}
