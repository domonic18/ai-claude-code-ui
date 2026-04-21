/**
 * OpenAI Codex SDK 执行器
 *
 * 提供 OpenAI Codex SDK 的集成，用于非交互式聊天会话。
 * 通过流式 API 与 Codex 交互，处理线程生命周期和事件流。
 *
 * ## 核心流程
 * 1. 创建 Codex 实例并启动/恢复线程（thread）
 * 2. 通过 runStreamed 发送用户命令
 * 3. 流式处理事件并通过 WebSocket 转发给客户端
 * 4. 完成后标记会话状态为 completed
 *
 * ## 用法
 * - queryCodex(command, options, ws) - 通过 WebSocket 流式执行提示
 * - abortCodexSession(sessionId) - 取消活动会话
 * - isCodexSessionActive(sessionId) - 检查会话是否正在运行
 * - getActiveCodexSessions() - 列出所有活动会话
 *
 * @module services/execution/codex/CodexExecutor
 */

import { Codex } from '@openai/codex-sdk';
import { createLogger } from '../../../utils/logger.js';
import { mapPermissionModeToCodexOptions } from './codexPermissionMapper.js';
import { processStreamEvents, sendMessage } from './codexStreamProcessor.js';
import { getActiveSessionsMap, abortCodexSession, isCodexSessionActive, getActiveCodexSessions } from './codexSessionManager.js';

const logger = createLogger('services/execution/codex/CodexExecutor');

/**
 * 使用流式执行 Codex 查询
 *
 * 完整流程：创建 Codex 实例 → 启动/恢复线程 → 流式执行命令 → 处理事件流 → 清理。
 * 会话在整个过程中被追踪在 activeCodexSessions Map 中。
 *
 * @param {string} command - 要发送的用户提示
 * @param {Object} [options] - 执行选项
 * @param {string} [options.sessionId] - 恢复已有线程的 ID
 * @param {string} [options.cwd] - 工作目录
 * @param {string} [options.projectPath] - 项目路径（cwd 的备选）
 * @param {string} [options.model] - Codex 模型名称
 * @param {string} [options.permissionMode='default'] - 权限模式（default/skip-all 等）
 * @param {WebSocket|Object} ws - WebSocket 连接或响应 writer
 * @returns {Promise<void>}
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
  // 将权限模式字符串映射为 Codex SDK 所需的 sandbox/approval 选项
  const { sandboxMode, approvalPolicy } = mapPermissionModeToCodexOptions(permissionMode);
  // 获取全局活跃会话 Map，用于追踪当前所有运行中的 Codex 线程
  const activeCodexSessions = getActiveSessionsMap();

  let codex;
  let thread;
  let currentSessionId = sessionId;

  try {
    // 创建 Codex SDK 实例
    codex = new Codex();

    const threadOptions = {
      workingDirectory,
      skipGitRepoCheck: true,
      sandboxMode,
      approvalPolicy,
      model
    };

    // 恢复已有线程或启动新线程
    if (sessionId) {
      thread = codex.resumeThread(sessionId, threadOptions);
    } else {
      thread = codex.startThread(threadOptions);
    }

    // 确定最终的会话 ID（优先使用线程返回的 ID）
    currentSessionId = thread.id || sessionId || `codex-${Date.now()}`;

    // 将会话注册到活跃会话追踪器
    activeCodexSessions.set(currentSessionId, {
      thread,
      codex,
      status: 'running',
      startedAt: new Date().toISOString()
    });

    // 通知客户端新会话已创建
    sendMessage(ws, {
      type: 'session-created',
      sessionId: currentSessionId,
      provider: 'codex'
    });

    // 流式执行用户命令
    const streamedTurn = await thread.runStreamed(command);

    // 处理流式事件并转发给客户端
    await processStreamEvents(streamedTurn, ws, currentSessionId, activeCodexSessions);

    // 通知客户端执行完成
    sendMessage(ws, {
      type: 'codex-complete',
      sessionId: currentSessionId,
      actualSessionId: thread.id
    });

  } catch (error) {
    logger.error('[Codex] Error:', error);

    // 将执行错误通过 WebSocket 发送给客户端
    sendMessage(ws, {
      type: 'codex-error',
      error: error.message,
      sessionId: currentSessionId
    });

  } finally {
    // 无论成功或失败，将会话状态标记为 completed
    if (currentSessionId) {
      const session = activeCodexSessions.get(currentSessionId);
      if (session) {
        session.status = 'completed';
      }
    }
  }
}

export { abortCodexSession, isCodexSessionActive, getActiveCodexSessions };

