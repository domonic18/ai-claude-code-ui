/**
 * OpenAI Codex SDK 集成
 * =============================
 *
 * 此模块提供与 OpenAI Codex SDK 的集成，用于非交互式聊天会话。
 * 它镜像了 claude-sdk.js 中使用的模式以保持一致性。
 *
 * ## 用法
 *
 * - queryCodex(command, options, ws) - 通过 WebSocket 流式执行提示
 * - abortCodexSession(sessionId) - 取消活动会话
 * - isCodexSessionActive(sessionId) - 检查会话是否正在运行
 * - getActiveCodexSessions() - 列出所有活动会话
 */

import { Codex } from '@openai/codex-sdk';
import { createLogger } from '../../../utils/logger.js';
import { mapPermissionModeToCodexOptions } from './codexPermissionMapper.js';
import { processStreamEvents, sendMessage } from './codexStreamProcessor.js';
import { getActiveSessionsMap, abortCodexSession, isCodexSessionActive, getActiveCodexSessions } from './codexSessionManager.js';

const logger = createLogger('services/execution/codex/CodexExecutor');

/**
 * 使用流式执行 Codex 查询
 * @param {string} command - 要发送的提示
 * @param {object} options - 选项，包括 cwd、sessionId、model、permissionMode
 * @param {WebSocket|object} ws - WebSocket 连接或响应 writer
 */
export async function queryCodex(command, options = {}, ws) {
  const {
    sessionId,
    cwd,
    projectPath,
    model,
    permissionMode = 'default'
  } = options;

  const workingDirectory = cwd || projectPath || process.cwd();
  const { sandboxMode, approvalPolicy } = mapPermissionModeToCodexOptions(permissionMode);
  const activeCodexSessions = getActiveSessionsMap();

  let codex;
  let thread;
  let currentSessionId = sessionId;

  try {
    codex = new Codex();

    const threadOptions = {
      workingDirectory,
      skipGitRepoCheck: true,
      sandboxMode,
      approvalPolicy,
      model
    };

    if (sessionId) {
      thread = codex.resumeThread(sessionId, threadOptions);
    } else {
      thread = codex.startThread(threadOptions);
    }

    currentSessionId = thread.id || sessionId || `codex-${Date.now()}`;

    activeCodexSessions.set(currentSessionId, {
      thread,
      codex,
      status: 'running',
      startedAt: new Date().toISOString()
    });

    sendMessage(ws, {
      type: 'session-created',
      sessionId: currentSessionId,
      provider: 'codex'
    });

    const streamedTurn = await thread.runStreamed(command);

    await processStreamEvents(streamedTurn, ws, currentSessionId, activeCodexSessions);

    sendMessage(ws, {
      type: 'codex-complete',
      sessionId: currentSessionId,
      actualSessionId: thread.id
    });

  } catch (error) {
    logger.error('[Codex] Error:', error);

    sendMessage(ws, {
      type: 'codex-error',
      error: error.message,
      sessionId: currentSessionId
    });

  } finally {
    if (currentSessionId) {
      const session = activeCodexSessions.get(currentSessionId);
      if (session) {
        session.status = 'completed';
      }
    }
  }
}

export { abortCodexSession, isCodexSessionActive, getActiveCodexSessions };

