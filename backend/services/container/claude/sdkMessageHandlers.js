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
    const logPayload = {
      sessionId,
      apiCallSeq: state.apiCallSeq,
      usageRaw: usage,
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      cacheCreation: usage?.cache_creation_input_tokens ?? null,
      cacheRead: usage?.cache_read_input_tokens ?? null,
      contentType: ctx.contentType,
      sinceLastMs,
    };
    // 第 1 轮额外 dump message 结构，排查 output_tokens=0（确认 usage 字段路径）
    if (state.apiCallSeq === 1 && sdkMessage.message) {
      logPayload._dumpMessageKeys = Object.keys(sdkMessage.message);
      logPayload._dumpStopReason = sdkMessage.message.stop_reason ?? null;
    }
    logger.info(logPayload, `[API #${state.apiCallSeq}] assistant turn`);
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

      const durationStr = durationMs !== null ? `  ${durationMs >= 1000 ? (durationMs / 1000).toFixed(1) + 's' : durationMs + 'ms'}` : '';
      const statusStr = tr.isError ? '  FAILED' : '  ok';
      logger.info(logPayload, `[ToolResult]  ${toolName}${statusStr}${durationStr}  ${(tr.resultPreview || '').substring(0, 100)}`);
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
