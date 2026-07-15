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
import { aliasSessionId, getSession } from './SessionManager.js';
import { documentService } from '../../documents/DocumentService.js';
import { LOG_THINKING_PREVIEW_CHARS } from '../../../config/logConfig.js';

const logger = createLogger('services/container/claude/sdkMessageHandlers');

// 匹配 API 代理返回的临时性错误（如 OneAPI 503/429/500）
const API_ERROR_PATTERN = /^API Error:\s*(\d{3})\b/i;

/**
 * 检测 assistant 消息文本是否为 API 代理错误（如 OneAPI 返回的 503、429 等）
 * @param {string} text - assistant 消息文本
 * @returns {{ isApiError: boolean, statusCode: number|null }}
 */
function detectApiError(text) {
  if (!text || typeof text !== 'string') return { isApiError: false, statusCode: null };
  const match = text.match(API_ERROR_PATTERN);
  if (match) {
    return { isApiError: true, statusCode: parseInt(match[1], 10) };
  }
  return { isApiError: false, statusCode: null };
}

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

  // API 推理埋点：每个 assistant message = 一次 API 调用（计轮数 / per-turn token / 推理时长）
  // sinceLastMs = 距上一个事件（tool_result 到达或上一轮 assistant）的间隔，
  // 近似本次推理耗时（含 SDK loop 开销，扣除工具执行即得纯推理）。
  if (state) {
    state.apiCallSeq = (state.apiCallSeq || 0) + 1;
    const now = Date.now();
    const sinceLastMs = state.lastEventTime ? now - state.lastEventTime : null;
    state.lastEventTime = now;
    const usage = sdkMessage.message?.usage || sdkMessage.usage || null;
    const msg = sdkMessage.message || {};
    const content = msg.content || sdkMessage.content;
    // content 块构成（诊断慢轮：是否含长 thinking）
    const blocks = {};
    let thinkingChars = 0;
    let thinkingPreview = null;
    if (Array.isArray(content)) {
      for (const p of content) {
        const t = p.type || 'unknown';
        blocks[t] = (blocks[t] || 0) + 1;
        if (t === 'thinking' && typeof p.thinking === 'string') {
          thinkingChars += p.thinking.length;
          if (!thinkingPreview) thinkingPreview = p.thinking.slice(0, LOG_THINKING_PREVIEW_CHARS);
        }
      }
    }
    const isSlow = sinceLastMs != null && sinceLastMs > 30000;
    const logPayload = {
      sessionId,
      apiCallSeq: state.apiCallSeq,
      usageRaw: usage,
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      cacheCreation: usage?.cache_creation_input_tokens ?? null,
      cacheRead: usage?.cache_read_input_tokens ?? null,
      contentType: ctx.contentType,
      stopReason: msg.stop_reason ?? null,
      contentBlocks: blocks,
      thinkingChars,
      sinceLastMs,
    };
    // 慢轮标记（>30s）
    if (isSlow) {
      logPayload._slowTurn = true;
    }
    // 所有 turn 都记 thinking 预览（前 N 字，info 常开）：能看到"在想什么"又不爆量
    // LOG_THINKING_PREVIEW_CHARS=0 可关闭；纯 tool_use turn 无 thinking 则不带此字段
    if (thinkingPreview) {
      logPayload.thinkingPreview = thinkingPreview;
    }
    // turn 级 delta 聚合（info 常开）：把这一轮的分片聚成 prefill/gen 两段
    // prefillMs=开口前等待(大 input 处理主体)；genMs=生成阶段；genRateCps=生成速率
    if (state.curTurnStats && state.curTurnStats.count > 0) {
      const ts = state.curTurnStats;
      const genMs = ts.lastTime - ts.firstTime;
      const totalChars = ts.thinkChars + ts.textChars + (ts.toolUseChars || 0);
      logPayload.prefillMs = ts.firstSinceLast; // turn#1 首片无上一片时为 null
      logPayload.genMs = genMs;
      logPayload.genRateCps = genMs > 0 ? Math.round(totalChars / (genMs / 1000)) : null;
      logPayload.deltaCount = ts.count;
    }
    state.curTurnStats = null; // 重置，下个 turn
    logger.info(logPayload, `[API #${state.apiCallSeq}] assistant turn${isSlow ? ' [SLOW]' : ''}`);
  }

  // 检测 API 代理错误（如 OneAPI 503 "无可用渠道"）
  if (ctx.contentType === 'text' && ctx.summary) {
    const { isApiError, statusCode } = detectApiError(ctx.summary);
    if (isApiError) {
      const isRetryable = statusCode >= 500 || statusCode === 429;
      logger.error(
        { sessionId, statusCode, isRetryable, summary: ctx.summary },
        `[Assistant] API proxy error detected (${statusCode})`
      );
      writer.send({
        type: 'claude-error',
        error: ctx.summary,
        meta: { source: 'api-proxy', statusCode, isRetryable }
      });
      return;
    }
  }

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

      // 检测 Write / Bash 工具调用 → 记录 AI 生成文档
      if (tool.name === 'Write') {
        _trackAIDocument(tool, sessionId, writer);
      } else if (tool.name === 'Bash') {
        _trackBashFileWrite(tool, sessionId, writer);
      }
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
      if (typeof tr.resultChars === 'number') {
        logPayload.resultChars = tr.resultChars;
      }

      const durationStr = durationMs !== null ? `  ${durationMs >= 1000 ? (durationMs / 1000).toFixed(1) + 's' : durationMs + 'ms'}` : '';
      const statusStr = tr.isError ? '  FAILED' : '  ok';
      const charsStr = typeof tr.resultChars === 'number' ? `  ${tr.resultChars}chars` : '';
      logger.info(logPayload, `[ToolResult]  ${toolName}${statusStr}${durationStr}${charsStr}  ${(tr.resultPreview || '').substring(0, 100)}`);
    }
    // 工具结果到达 = 事件点，用于配对下一轮 assistant 的推理时长
    state.lastEventTime = Date.now();
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
 * 检测 Write 工具调用并记录 AI 生成文档
 * 从会话信息中提取 userId 和 projectName，异步写入文档清单
 * @param {Object} tool - 工具调用信息 { name, id, input: { file } }
 * @param {string} sessionId - 会话 ID
 * @param {Object} writer - WebSocket 写入器
 */
function _trackAIDocument(tool, sessionId, writer) {
  const filePath = tool.input?.file;
  if (!filePath) return;

  // 从会话信息获取 userId 和项目路径
  const session = getSession(sessionId);
  if (!session) return;

  const userId = session.userId;
  const cwd = session.options?.cwd || '';

  // 从 cwd 提取项目名（如 /workspace/my-project → my-project）
  const projectName = cwd.replace(/\/workspace\/?/, '').split('/')[0];
  if (!userId || !projectName) return;

  // 解析相对路径为绝对路径（与 _trackBashFileWrite 保持一致）
  let absolutePath = filePath;
  if (!filePath.startsWith('/')) {
    absolutePath = `${cwd}/${filePath}`.replace(/\/+/g, '/').replace(/\/\.\//g, '/');
  }

  // 只追踪工作区内的文件
  if (!absolutePath.startsWith('/workspace/')) return;

  // 立即通知前端有新文档（不等 recordAIDocument 完成）
  // recordAIDocument 涉及 Docker I/O（读/写 manifest），可能耗时数秒
  // 如果先等它完成再发事件，前端右侧面板看不到实时更新
  writer.send({
    type: 'document-created',
    data: {
      file_path: absolutePath,
      file_name: absolutePath.split('/').pop(),
      conversation_id: sessionId,
      message_id: tool.id,
      type: 'ai_generated'
    }
  });

  // 异步记录到 manifest + 触发摘要生成，不阻塞主消息流
  documentService.recordAIDocument(userId, projectName, {
    file_path: absolutePath,
    conversation_id: sessionId,
    message_id: tool.id
  }).catch(err => {
    logger.warn({ err, sessionId, filePath: absolutePath }, '[DocumentTracker] Failed to record AI document');
  });
}

/**
 * 检测 Bash 工具调用中的文件写入操作并记录 AI 生成文档
 * 匹配常见模式：cat > file, tee file, echo > file, 重定向 > file
 * @param {Object} tool - 工具调用信息 { name, id, input: { command } }
 * @param {string} sessionId - 会话 ID
 * @param {Object} writer - WebSocket 写入器
 */
function _trackBashFileWrite(tool, sessionId, writer) {
  const command = tool.input?.command;
  if (!command) return;

  // 从会话信息获取 cwd，用于拼接相对路径
  const session = getSession(sessionId);
  if (!session) return;

  const userId = session.userId;
  const cwd = session.options?.cwd || '/workspace';
  const projectName = cwd.replace(/\/workspace\/?/, '').split('/')[0];
  if (!userId || !projectName) return;

  // 从 Bash 命令中提取文件写入路径
  const filePaths = _extractFilePathsFromBash(command);
  if (filePaths.length === 0) return;

  for (const filePath of filePaths) {
    // 解析相对路径为绝对路径
    let absolutePath = filePath;
    if (filePath.startsWith('./') || filePath.startsWith('../')) {
      absolutePath = `${cwd}/${filePath}`.replace(/\/+/g, '/').replace(/\/\.\//g, '/');
    }

    // 只追踪工作区内的文件，跳过 .claude/ 目录下的配置文件
    if (!absolutePath.startsWith('/workspace/')) continue;
    if (absolutePath.includes('/.claude/')) continue;

    // 立即通知前端（不等 recordAIDocument 的 Docker I/O 完成）
    writer.send({
      type: 'document-created',
      data: {
        file_path: absolutePath,
        file_name: absolutePath.split('/').pop(),
        conversation_id: sessionId,
        message_id: tool.id,
        type: 'ai_generated'
      }
    });

    // 异步记录到 manifest + 触发摘要生成
    documentService.recordAIDocument(userId, projectName, {
      file_path: absolutePath,
      conversation_id: sessionId,
      message_id: tool.id
    }).catch(err => {
      logger.debug({ err, sessionId, command: command.substring(0, 100) }, '[BashTracker] Failed to track Bash file write');
    });
  }
}

/**
 * 从 Bash 命令字符串中提取文件写入目标路径
 * @param {string} command - Bash 命令
 * @returns {string[]} 文件路径数组
 */
function _extractFilePathsFromBash(command) {
  // 先移除 heredoc 内容，避免误匹配 heredoc 内部的重定向符号
  // 匹配 << 'DELIM'\n...\nDELIM 或 << "DELIM"\n...\nDELIM 或 << DELIM\n...\nDELIM
  const cleaned = command.replace(/<<-?\s*['"]?(\w+)['"]?\n[\s\S]*?\n\s*\1/g, '');

  const paths = [];

  // 匹配写入重定向模式：> file 或 >> file
  // 覆盖 cat > file, echo > file, printf > file, 以及裸重定向
  const redirectPattern = />{1,2}\s*['"]?((?:\.\/|\.\.\/|\/)[^\s'";&|>]+)['"]?/g;
  let match;
  while ((match = redirectPattern.exec(cleaned)) !== null) {
    const p = match[1];
    if (p && !p.startsWith('&')) {
      paths.push(p);
    }
  }

  // 匹配 tee 命令：tee file / tee -a file
  const teePattern = /\btee\s+(?:-[aA]+\s+)?['"]?((?:\.\/|\.\.\/|\/)[^\s'";&|>]+)['"]?/g;
  while ((match = teePattern.exec(cleaned)) !== null) {
    paths.push(match[1]);
  }

  return [...new Set(paths)];
}

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

/**
 * 处理逐 token 流式事件（stream_event 包装的是 Anthropic 原始 SSE 事件）。
 *
 * includePartialMessages 开启后 SDK 会 yield stream_event。此处把 content_block_delta
 * 的 text/thinking 增量包装成 claude-response 消息转发，复用前端已有的
 * updateStreamContent 渲染逻辑；content_block_stop 触发 completeStream 收尾。
 * 同时在 state.deltas 累积到达时间戳，供流式节奏诊断（emitDeltaCadence）使用。
 *
 * 逐片可观测：每片 text/thinking delta 额外输出 [DELTA/text] / [DELTA/thinking] 日志，
 * 含 sinceTurnMs(距本轮起点)、sinceLastMs(距上一片)、文本与字符数，可还原生成速率与全文。
 * message_start 作为 turn 起点(若 SDK 透传)，第一片 delta 的 sinceTurnMs ≈ prefill 时间。
 *
 * 注：Anthropic SSE 的 delta 是 union 类型，单事件只携带 text 或 thinking 之一，
 * 故用 if/else if 互斥处理即可。
 *
 * @param {Object} event - Anthropic 原始 SSE 事件对象
 * @param {Object} writer - 消息写入器
 * @param {Object} state - 状态对象（含 deltas/textDeltaCount/thinkingDeltaCount）
 */
export function handleStreamEvent(event, writer, state) {
  // 每轮 API 推理起点：message_start 作为 turn 边界。
  // 第一片 delta 的 sinceTurnMs ≈ prefill 时间（API 开始 → 首个 token），
  // 补上 [API #seq] 无法拆分的 prefill/生成盲区。
  if (event.type === 'message_start') {
    state.turnStartTime = Date.now();
    state.turnDeltaCount = 0;
    return;
  }

  if (event.type === 'content_block_delta' && event.delta) {
    const now = Date.now();
    // 注意：用独立的 lastDeltaTime，不碰 state.lastEventTime（供 [API #seq] 的 sinceLastMs）
    const sinceLastMs = state.lastDeltaTime ? now - state.lastDeltaTime : null;
    const sinceTurnMs = state.turnStartTime ? now - state.turnStartTime : null;
    const turnSeq = (state.apiCallSeq || 0) + 1; // delta 在 turn 结束前到达，apiCallSeq 尚未递增

    // 累积当前 turn 的 delta 统计，供 handleAssistantMessage 聚合成 prefill/gen（info 常开）
    if (!state.curTurnStats) {
      state.curTurnStats = { firstTime: null, firstSinceLast: null, lastTime: null, thinkChars: 0, textChars: 0, toolUseChars: 0, count: 0 };
    }
    const ts = state.curTurnStats;
    if (ts.firstTime === null) { ts.firstTime = now; ts.firstSinceLast = sinceLastMs; } // 首片 sinceLastMs ≈ prefill
    ts.lastTime = now;
    ts.count++;

    if (typeof event.delta.text === 'string') {
      if (Array.isArray(state.deltas)) state.deltas.push(now);
      state.textDeltaCount = (state.textDeltaCount || 0) + 1;
      state.turnDeltaCount = (state.turnDeltaCount || 0) + 1;
      state.lastDeltaTime = now;
      ts.textChars += event.delta.text.length;
      // 分片日志：debug 级（默认关），排查时设 LOG_LEVEL=debug 才输出
      logger.debug({
        deltaType: 'text',
        seq: state.textDeltaCount,
        turnSeq,
        inTurn: state.turnDeltaCount,
        chars: event.delta.text.length,
        text: event.delta.text,
        sinceTurnMs,
        sinceLastMs,
      }, `[DELTA/text] turn#${turnSeq} #${state.textDeltaCount} ${event.delta.text.length}c`);
      writer.send({
        type: 'claude-response',
        data: { type: 'content_block_delta', delta: { text: event.delta.text } }
      });
    } else if (typeof event.delta.thinking === 'string') {
      if (Array.isArray(state.deltas)) state.deltas.push(now);
      state.thinkingDeltaCount = (state.thinkingDeltaCount || 0) + 1;
      state.turnDeltaCount = (state.turnDeltaCount || 0) + 1;
      state.lastDeltaTime = now;
      ts.thinkChars += event.delta.thinking.length;
      // 分片日志：debug 级（默认关），排查时设 LOG_LEVEL=debug 才输出
      logger.debug({
        deltaType: 'thinking',
        seq: state.thinkingDeltaCount,
        turnSeq,
        inTurn: state.turnDeltaCount,
        chars: event.delta.thinking.length,
        text: event.delta.thinking,
        sinceTurnMs,
        sinceLastMs,
      }, `[DELTA/thinking] turn#${turnSeq} #${state.thinkingDeltaCount} ${event.delta.thinking.length}c`);
      writer.send({
        type: 'claude-response',
        data: { type: 'content_block_delta', delta: { thinking: event.delta.thinking } }
      });
    } else if (typeof event.delta.partial_json === 'string') {
      // tool_use 参数生成(input_json_delta)：累积到 turn 统计，让 tool_use turn 也有 genMs
      // 不转发前端（前端用完整 tool_use block）；lastDeltaTime 更新让下一 turn prefillMs 不含本段
      if (Array.isArray(state.deltas)) state.deltas.push(now);
      state.toolUseDeltaCount = (state.toolUseDeltaCount || 0) + 1;
      state.turnDeltaCount = (state.turnDeltaCount || 0) + 1;
      state.lastDeltaTime = now;
      ts.toolUseChars += event.delta.partial_json.length;
    }
  } else if (event.type === 'content_block_stop') {
    writer.send({
      type: 'claude-response',
      data: { type: 'content_block_stop' }
    });
  }
}
