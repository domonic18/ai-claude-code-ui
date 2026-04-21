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

import { queryClaudeSDKInContainer, abortClaudeSDKSessionInContainer, isClaudeSDKSessionActiveInContainer } from '../../services/container/claude/index.js';
import { spawnCursor, abortCursorSession, isCursorSessionActive, getActiveCursorSessions } from '../../services/execution/cursor/index.js';
import { queryCodex, abortCodexSession, isCodexSessionActive, getActiveCodexSessions } from '../../services/execution/codex/index.js';
import { WebSocketWriter } from '../writer.js';
import { formatReadInstructions } from '../../services/files/FileDocumentReader.js';
import { createLogger, sanitizePreview } from '../../utils/logger.js';

const logger = createLogger('websocket/handlers/chat');

/**
 * 构建发送给 Claude 的命令，处理文档和图片附件
 *
 * 将用户上传的文档附件转换为读取指令，拼接到原始命令中，
 * 并将图片附件单独提取供 SDK 使用。
 *
 * @param {Object} data - 客户端发送的消息数据
 * @param {string} data.command - 用户输入的原始命令
 * @param {Array} [data.attachments] - 附件列表
 * @param {Array} data.attachments[].path - 文档附件的文件路径
 * @param {Array} data.attachments[].data - 图片附件的 base64 数据
 * @returns {{command: string, imageAttachments: Array}} 处理后的命令和图片附件
 */
function buildClaudeCommand(data) {
  let command = data.command || '';
  const attachments = data.attachments || [];
  // 区分文档附件（通过路径引用）和图片附件（通过 base64 数据）
  const documentAttachments = attachments.filter(f => f.path);
  const imageAttachments = attachments.filter(f => f.data);

  if (documentAttachments.length > 0) {
    const filePaths = documentAttachments.map(f => ({ path: f.path, name: f.name, type: f.type }));
    const readInstructions = formatReadInstructions(filePaths);
    command = `I have uploaded the following files:\n\n${readInstructions}\n\nPlease read each file content using the specified method, then answer: ${command}`;
  }

  return { command, imageAttachments };
}

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
  const { command, imageAttachments } = buildClaudeCommand(data);

  const containerOptions = {
    ...data.options,
    userId: ws.user.userId,
    isContainerProject: true,
    projectPath: originalProjectName,
    images: imageAttachments.length > 0 ? imageAttachments : undefined,
  };

  logger.debug({ preview: sanitizePreview(command), totalLength: command?.length || 0 }, '[WebSocket] Executing claude-command');
  await queryClaudeSDKInContainer(command, containerOptions, writer);
}

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
    logger.debug({ model: data.options?.model, hasAttachments: !!(data.attachments?.length) }, '[WebSocket] Received claude-command');
    await handleClaudeCommand(data, ws, writer);
  },
  'cursor-command': async (data, ws, writer) => {
    await spawnCursor(data.command, data.options, writer);
  },
  'codex-command': async (data, ws, writer) => {
    await queryCodex(data.command, data.options, writer);
  },
  'cursor-resume': async (data, ws, writer) => {
    await spawnCursor('', { sessionId: data.sessionId, resume: true, cwd: data.options?.cwd }, writer);
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
  'get-active-sessions': async (data, ws, writer) => {
    writer.send({ type: 'active-sessions', sessions: { cursor: getActiveCursorSessions(), codex: getActiveCodexSessions() } });
  },
};

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
      // 根据 message.type 路由到对应处理器
      const handler = COMMAND_HANDLERS[data.type];
      if (handler) {
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
  });
}
