/**
 * 聊天 WebSocket 处理器
 *
 * 处理与 AI 提供商聊天交互的 WebSocket 连接。
 * 根据消息类型将消息路由到 Claude、Cursor 或 Codex。
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

function buildClaudeCommand(data) {
  let command = data.command || '';
  const attachments = data.attachments || [];
  const documentAttachments = attachments.filter(f => f.path);
  const imageAttachments = attachments.filter(f => f.data);

  if (documentAttachments.length > 0) {
    const filePaths = documentAttachments.map(f => ({ path: f.path, name: f.name, type: f.type }));
    const readInstructions = formatReadInstructions(filePaths);
    command = `I have uploaded the following files:\n\n${readInstructions}\n\nPlease read each file content using the specified method, then answer: ${command}`;
  }

  return { command, imageAttachments };
}

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

function abortSession(data, writer) {
  const provider = data.provider || 'claude';
  let success;
  if (provider === 'cursor') success = abortCursorSession(data.sessionId);
  else if (provider === 'codex') success = abortCodexSession(data.sessionId);
  else success = abortClaudeSDKSessionInContainer(data.sessionId);
  return { type: 'session-aborted', sessionId: data.sessionId, provider, success };
}

function checkSessionStatus(data, writer) {
  const provider = data.provider || 'claude';
  const sessionId = data.sessionId;
  let isActive;
  if (provider === 'cursor') isActive = isCursorSessionActive(sessionId);
  else if (provider === 'codex') isActive = isCodexSessionActive(sessionId);
  else isActive = isClaudeSDKSessionActiveInContainer(sessionId);
  return { type: 'session-status', sessionId, provider, isProcessing: isActive };
}

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

export function handleChatConnection(ws, connectedClients) {
  logger.info('Chat WebSocket connected');
  connectedClients.add(ws);
  const writer = new WebSocketWriter(ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
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
