/**
 * 聊天 WebSocket 处理器
 *
 * 处理与 AI 提供商聊天交互的 WebSocket 连接。
 * 根据消息类型将消息路由到 Claude、Cursor 或 Codex 对应的执行器。
 *
 * ## 消息类型路由
 * - claude-command       — 执行 Claude 命令（通过容器内 SDK）
 * - cursor-command       — 执行 Cursor 命令（启动 cursor-agent 进程）
 * - codex-command        — 执行 Codex 命令
 * - cursor-resume        — 恢复 Cursor 会话
 * - abort-session        — 中止指定提供商的活跃会话
 * - cursor-abort         — 中止 Cursor 会话
 * - check-session-status — 检查会话是否仍在处理
 * - get-active-sessions  — 获取所有活跃会话列表
 *
 * @module websocket/handlers/chat
 */

import { queryClaudeSDKInContainer, abortClaudeSDKSessionInContainer, isClaudeSDKSessionActiveInContainer, getSessionStdin, scheduleSessionCleanup, cancelSessionCleanup, setSessionWriter, getSessionForUser } from '../../services/container/claude/index.js';
import { spawnCursor, abortCursorSession, isCursorSessionActive, getActiveCursorSessions } from '../../services/execution/cursor/index.js';
import { queryCodex, abortCodexSession, isCodexSessionActive, getActiveCodexSessions } from '../../services/execution/codex/index.js';
import { WebSocketWriter } from '../writer.js';
import { formatReadInstructions } from '../../services/files/FileDocumentReader.js';
import { readmeService } from '../../services/documents/ReadmeService.js';
import { createLogger, sanitizePreview, generateTraceId, generateSpanId, runWithTrace, startTimer } from '../../utils/logger.js';
import { recordActivity } from '../../utils/usage-session-tracker.js';
import containerManager from '../../services/container/core/index.js';
import { PassThrough } from 'stream';

const logger = createLogger('websocket/handlers/chat');

/**
 * ws 断开后保留会话的宽限期（毫秒）。
 * 刷新场景：旧连接断开后任务继续在容器内执行，给前端重连 + subscribe 一个时间窗口；
 * 超时未重连则 scheduleSessionCleanup→abortSession 释放容器资源，防泄漏与占用。
 */
const CLAUDE_GRACE_MS = 120000;

/** 图片扩展名集合，用于识别路径引用的图片附件 */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

/** 图片扩展名 → MIME 类型映射 */
const IMAGE_MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * 判断文件路径是否为图片
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
function isImagePath(filePath) {
  const ext = '.' + (filePath.split('.').pop() || '').toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * 从容器中读取图片文件并转为 base64 data URL
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 容器内文件绝对路径
 * @returns {Promise<string>} data URL 格式的 base64 图片
 */
async function readImageFromContainer(userId, filePath) {
  const ext = '.' + (filePath.split('.').pop() || '').toLowerCase();
  const mimeType = IMAGE_MIME_MAP[ext] || 'image/octet-stream';

  const { stream } = await containerManager.execInContainer(userId, ['base64', filePath]);
  const output = await new Promise((resolve, reject) => {
    const stdout = new PassThrough();
    containerManager.docker.modem.demuxStream(stream, stdout, new PassThrough());
    let data = '';
    stdout.on('data', (chunk) => { data += chunk.toString(); });
    stream.on('error', reject);
    stream.on('end', () => resolve(data));
  });

  const base64Data = output.replace(/\s/g, '');
  return `data:${mimeType};base64,${base64Data}`;
}

// WebSocket 消息或事件处理
/**
 * 构建发送给 Claude 的命令，处理文档和图片附件
 *
 * 将用户上传的文档附件转换为读取指令，拼接到原始命令中，
 * 并将图片附件单独提取供 SDK 使用。
 * 支持三种附件类型：
 * 1. 带 data 的 base64 图片（拖拽上传）
 * 2. 带 path 的图片文件（@ 引用上传的图片）
 * 3. 带 path 的文档文件（PDF、DOCX 等）
 *
 * @param {Object} data - 客户端发送的消息数据
 * @param {number} userId - 用户 ID，用于容器访问
 * @param {string} [projectName] - 项目名称，用于注入文档上下文
 * @returns {Promise<{command: string, imageAttachments: Array}>} 处理后的命令和图片附件
 */
async function buildClaudeCommand(data, userId, projectName) {
  // 用户命令保持原样：系统上下文不再拼进 command，改为累积到 systemContextParts，
  // 最终经 systemPrompt.append 注入，使 SDK 的 user turn 即用户原始输入（避免气泡泄露）
  const command = data.command || '';
  const attachments = data.attachments || [];

  // 区分三种附件类型
  const imageAttachments = attachments.filter(f => f.data);
  const pathAttachments = attachments.filter(f => f.path && !f.data);
  const imagePathAttachments = pathAttachments.filter(f => isImagePath(f.path));
  const documentAttachments = pathAttachments.filter(f => !isImagePath(f.path));

  // 处理 @ 引用的图片：从容器读取并转为 base64
  if (imagePathAttachments.length > 0 && userId) {
    for (const img of imagePathAttachments) {
      try {
        const dataUrl = await readImageFromContainer(userId, img.path);
        imageAttachments.push({
          ...img,
          data: dataUrl,
        });
      } catch (err) {
        logger.warn({ err, filePath: img.path, userId }, '[buildClaudeCommand] Failed to read image from container, treating as document');
        // 读取失败则降级为文档处理
        documentAttachments.push(img);
      }
    }
  }

  // 系统上下文分片：文档读取指令、项目文档索引等不再拼进用户命令，
  // 而是累积到 systemContextParts，最终经 systemPrompt.append 注入（保持用户消息为原始输入）
  const systemContextParts = [];

  // 文档附件读取指令（确保 @ 文件被优先读取）
  if (documentAttachments.length > 0) {
    const filePaths = documentAttachments.map(f => ({ path: f.path, name: f.name, type: f.type }));
    const readInstructions = formatReadInstructions(filePaths);
    systemContextParts.push(
      `The user has referenced the following files — read these FIRST:\n\n${readInstructions}\n\nAfter reading the referenced files, answer the user's question below.`
    );
  }

  // 注入项目文档索引作为轻量知识库（摘要级上下文，按需读取全文）
  if (projectName && userId) {
    try {
      const readmeContent = await readmeService.readReadme(userId, projectName);
      if (readmeContent) {
        logger.info({ projectName, userId, readmeLength: readmeContent.length }, '[buildClaudeCommand] 注入项目文档索引');
        systemContextParts.push(
          `[项目文档索引 — 以下是项目中所有可用文档的摘要目录，仅当回答问题需要时才按需读取对应文件全文]\n${readmeContent}`
        );
      }
    } catch (err) {
      logger.warn({ err, projectName, userId }, '[buildClaudeCommand] 读取 readme.md 失败，跳过上下文注入');
    }
  }

  return { command, imageAttachments, systemContextParts };
}

// WebSocket 消息或事件处理
/**
 * 处理 Claude 命令：构建命令并调用容器内 SDK 执行
 *
 * @param {Object} data - 客户端消息数据
 * @param {Object} data.options - 执行选项（含 projectPath、model 等）
 * @param {Object} ws - WebSocket 连接（含 user.userId）
 * @param {WebSocketWriter} writer - 响应写入器
 * @returns {Promise<void>}
 */
async function handleClaudeCommand(data, ws, writer) {
  const originalProjectName = data.options?.projectPath?.replace(/\//g, '-') || '';
  const cmdTimer = startTimer('chat/command_build');
  const { command, imageAttachments, systemContextParts } = await buildClaudeCommand(data, ws.user?.userId, originalProjectName);
  cmdTimer.end(logger, 'Command built', { userId: ws.user?.userId, projectPath: originalProjectName });

  logger.info({
    userId: ws.user.userId,
    preview: sanitizePreview(data.command),
    totalLength: data.command?.length || 0,
    model: data.options?.model,
    projectPath: originalProjectName,
    hasAttachments: !!(data.attachments?.length),
    hasImages: imageAttachments.length > 0,
  }, '[Chat] User message received');

  const containerOptions = {
    ...data.options,
    userId: ws.user.userId,
    isContainerProject: true,
    projectPath: originalProjectName,
    images: imageAttachments.length > 0 ? imageAttachments : undefined,
    skill: data.options?.skill || undefined,
    // 系统上下文分片（文档索引/文件读取指令等），最终由 systemPrompt.append 注入
    systemContextParts,
  };

  // 追踪活跃会话，ws 关闭时自动中止
  ws.activeSessionId = containerOptions.sessionId || containerOptions.tempSessionId;
  try {
    await queryClaudeSDKInContainer(command, containerOptions, writer);
  } finally {
    // 完成后清除追踪，避免误 abort 后续会话
    ws.activeSessionId = null;
  }
}

// WebSocket 消息或事件处理
/**
 * 中止指定提供商的活跃会话
 *
 * 根据 provider 字段路由到对应的会话中止方法。
 *
 * @param {Object} data - 请求数据
 * @param {string} data.sessionId - 要中止的会话 ID
 * @param {string} [data.provider='claude'] - AI 提供商（claude/cursor/codex）
 * @param {WebSocketWriter} writer - 响应写入器
 * @returns {{type: string, sessionId: string, provider: string, success: boolean}}
 */
function abortSession(data, writer) {
  const provider = data.provider || 'claude';
  let success;
  if (provider === 'cursor') success = abortCursorSession(data.sessionId);
  else if (provider === 'codex') success = abortCodexSession(data.sessionId);
  else success = abortClaudeSDKSessionInContainer(data.sessionId);
  return { type: 'session-aborted', sessionId: data.sessionId, provider, success };
}

// WebSocket 消息或事件处理
/**
 * 检查指定会话是否仍在处理中
 *
 * @param {Object} data - 请求数据
 * @param {string} data.sessionId - 会话 ID
 * @param {string} [data.provider='claude'] - AI 提供商
 * @param {WebSocketWriter} writer - 响应写入器
 * @returns {{type: string, sessionId: string, provider: string, isProcessing: boolean}}
 */
function checkSessionStatus(data, writer) {
  const provider = data.provider || 'claude';
  const sessionId = data.sessionId;
  let isActive;
  if (provider === 'cursor') isActive = isCursorSessionActive(sessionId);
  else if (provider === 'codex') isActive = isCodexSessionActive(sessionId);
  else isActive = isClaudeSDKSessionActiveInContainer(sessionId);
  return { type: 'session-status', sessionId, provider, isProcessing: isActive };
}

/**
 * 消息类型到处理器的映射表
 *
 * 每个处理器接收 (data, ws, writer) 三个参数：
 * - data: 解析后的 JSON 消息
 * - ws: WebSocket 连接实例
 * - writer: WebSocketWriter 响应写入器
 *
 * @type {Record<string, Function>}
 */
const COMMAND_HANDLERS = {
  'claude-command': async (data, ws, writer) => {
    const userId = ws.user?.userId;
    recordActivity(userId);
    try {
      await handleClaudeCommand(data, ws, writer);
    } finally {
      recordActivity(userId);
    }
  },
  'cursor-command': async (data, ws, writer) => {
    const userId = ws.user?.userId;
    recordActivity(userId);
    logger.info({
      userId,
      preview: sanitizePreview(data.command),
      totalLength: data.command?.length || 0,
      provider: 'cursor',
    }, '[Chat] User message received');
    try {
      await spawnCursor(data.command, data.options, writer);
    } finally {
      recordActivity(userId);
    }
  },
  'codex-command': async (data, ws, writer) => {
    const userId = ws.user?.userId;
    recordActivity(userId);
    logger.info({
      userId,
      preview: sanitizePreview(data.command),
      totalLength: data.command?.length || 0,
      provider: 'codex',
    }, '[Chat] User message received');
    try {
      await queryCodex(data.command, data.options, writer);
    } finally {
      recordActivity(userId);
    }
  },
  'cursor-resume': async (data, ws, writer) => {
    const userId = ws.user?.userId;
    recordActivity(userId);
    try {
      await spawnCursor('', { sessionId: data.sessionId, resume: true, cwd: data.options?.cwd }, writer);
    } finally {
      recordActivity(userId);
    }
  },
  'abort-session': async (data, ws, writer) => {
    writer.send(await abortSession(data, writer));
  },
  'cursor-abort': async (data, ws, writer) => {
    writer.send({ type: 'session-aborted', sessionId: data.sessionId, provider: 'cursor', success: abortCursorSession(data.sessionId) });
  },
  'check-session-status': async (data, ws, writer) => {
    writer.send(checkSessionStatus(data, writer));
  },
  /**
   * 刷新重连后订阅正在执行的会话：替换 writer 使后续流式输出转发到新连接
   * 会话不存在 / 非本人 / 已结束 → 回 session-status:false，前端走历史加载
   */
  'subscribe-session': async (data, ws, writer) => {
    const userId = ws.user?.userId;
    recordActivity(userId);
    const sessionId = data.sessionId;
    // 所有权校验：仅会话创建者可订阅，防跨用户截获输出
    // 不存在/非本人统一回 not-active，不泄露会话存在性
    const session = getSessionForUser(sessionId, userId);
    if (session && isClaudeSDKSessionActiveInContainer(sessionId)) {
      // 任务仍在跑：替换为新连接的 writer，后续流式输出转发到新 ws；取消宽限期清理
      cancelSessionCleanup(sessionId);
      setSessionWriter(sessionId, writer);
      logger.info({ sessionId, userId }, '[WebSocket] Client subscribed to active session, writer replaced');
      writer.send({ type: 'session-resumed', sessionId, provider: 'claude', isProcessing: true });
    } else {
      logger.info({ sessionId, userId, active: !!session }, '[WebSocket] Subscribe target not active, client should load history');
      writer.send({ type: 'session-status', sessionId, provider: 'claude', isProcessing: false });
    }
  },
  'get-active-sessions': async (data, ws, writer) => {
    writer.send({ type: 'active-sessions', sessions: { cursor: getActiveCursorSessions(), codex: getActiveCodexSessions() } });
  },
  /**
   * 处理前端用户对 Agent 提问的回答
   * 将用户回答通过 stdin 写入容器，让 SDK 的 canUseTool 回调继续执行
   */
  'user-answer': async (data, ws, writer) => {
    const { sessionId, toolUseID, answer } = data;
    logger.info({ sessionId, toolUseID }, '[WebSocket] Received user-answer');

    // 用户回复也算活跃操作（续期使用会话）
    recordActivity(ws.user?.userId);

    const stdinWriter = getSessionStdin(sessionId, ws.user?.userId);
    if (!stdinWriter) {
      logger.warn({ sessionId }, '[WebSocket] No stdin writer found for session');
      writer.send({ type: 'error', error: 'Session not found or access denied', sessionId });
      return;
    }

    // 写入 JSON 行协议到容器 stdin
    const answerMessage = JSON.stringify({
      type: 'user-answer',
      toolUseID,
      answer: answer || ''
    }) + '\n';

    logger.debug({ sessionId, toolUseID }, '[WebSocket] Writing answer to container stdin');
    stdinWriter(answerMessage);
  },
};

// WebSocket 消息或事件处理
/**
 * 处理新的聊天 WebSocket 连接
 *
 * 将客户端加入连接池，监听消息事件并路由到对应处理器。
 * 连接断开时自动从连接池中移除。
 *
 * @param {WebSocket} ws - WebSocket 连接实例
 * @param {Set} connectedClients - 当前所有已连接客户端的集合
 */
export function handleChatConnection(ws, connectedClients) {
  logger.info('Chat WebSocket connected');
  connectedClients.add(ws);
  const writer = new WebSocketWriter(ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      // 应用层心跳：浏览器无法用协议层 ping 主动探活，客户端发 {type:'ping'} 探测连接活性
      if (data.type === 'ping') {
        writer.send({ type: 'pong' });
        return;
      }
      // 根据 message.type 路由到对应处理器
      const handler = COMMAND_HANDLERS[data.type];
      if (!handler) return;

      // 为需要链路追踪的消息类型注入 traceId/spanId
      const needsTrace = ['claude-command', 'cursor-command', 'codex-command', 'user-answer'].includes(data.type);
      if (needsTrace) {
        const traceId = generateTraceId();
        const spanId = generateSpanId();
        const userId = ws.user?.userId;
        const sessionId = data.options?.sessionId || data.sessionId;

        const traceContext = { traceId, spanId };
        if (userId) traceContext.userId = userId;
        if (sessionId) traceContext.sessionId = sessionId;

        await runWithTrace(traceContext, () => handler(data, ws, writer));
      } else {
        await handler(data, ws, writer);
      }
    } catch (error) {
      logger.error({ err: error }, '[WebSocket] Chat message handling error');
      writer.send({ type: 'error', error: error.message });
    }
  });

  ws.on('close', () => {
    logger.info('Chat client disconnected');
    connectedClients.delete(ws);
    // 不再立即 abort：改为启动宽限期清理，支持刷新重连续传。
    // 期间若有新连接 subscribe 该会话则取消清理；超时未重连才 abort 释放资源。
    if (ws.activeSessionId) {
      scheduleSessionCleanup(ws.activeSessionId, CLAUDE_GRACE_MS);
      logger.info({ sessionId: ws.activeSessionId, graceMs: CLAUDE_GRACE_MS }, '[WebSocket] Scheduled session cleanup on disconnect (grace period)');
    }
  });

  ws.on('error', (err) => {
    logger.error({ err }, '[WebSocket] Chat connection error');
    connectedClients.delete(ws);
    // 连接出错同样进入宽限期（与 close 一致），保留重连续传可能
    if (ws.activeSessionId) {
      scheduleSessionCleanup(ws.activeSessionId, CLAUDE_GRACE_MS);
      logger.info({ sessionId: ws.activeSessionId, graceMs: CLAUDE_GRACE_MS }, '[WebSocket] Scheduled session cleanup on error (grace period)');
    }
  });
}

