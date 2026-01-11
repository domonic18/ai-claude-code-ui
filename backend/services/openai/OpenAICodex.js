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

// 跟踪活动会话
const activeCodexSessions = new Map();

/**
 * 将 Codex SDK 事件转换为 WebSocket 消息格式
 * @param {object} event - SDK 事件
 * @returns {object} - 为 WebSocket 转换的事件
 */
function transformCodexEvent(event) {
  // 将 SDK 事件类型映射为一致的格式
  switch (event.type) {
    case 'item.started':
    case 'item.updated':
    case 'item.completed':
      const item = event.item;
      if (!item) {
        return { type: event.type, item: null };
      }

      // 基于项目类型进行转换
      switch (item.type) {
        case 'agent_message':
          return {
            type: 'item',
            itemType: 'agent_message',
            message: {
              role: 'assistant',
              content: item.text
            }
          };

        case 'reasoning':
          return {
            type: 'item',
            itemType: 'reasoning',
            message: {
              role: 'assistant',
              content: item.text,
              isReasoning: true
            }
          };

        case 'command_execution':
          return {
            type: 'item',
            itemType: 'command_execution',
            command: item.command,
            output: item.aggregated_output,
            exitCode: item.exit_code,
            status: item.status
          };

        case 'file_change':
          return {
            type: 'item',
            itemType: 'file_change',
            changes: item.changes,
            status: item.status
          };

        case 'mcp_tool_call':
          return {
            type: 'item',
            itemType: 'mcp_tool_call',
            server: item.server,
            tool: item.tool,
            arguments: item.arguments,
            result: item.result,
            error: item.error,
            status: item.status
          };

        case 'web_search':
          return {
            type: 'item',
            itemType: 'web_search',
            query: item.query
          };

        case 'todo_list':
          return {
            type: 'item',
            itemType: 'todo_list',
            items: item.items
          };

        case 'error':
          return {
            type: 'item',
            itemType: 'error',
            message: {
              role: 'error',
              content: item.message
            }
          };

        default:
          return {
            type: 'item',
            itemType: item.type,
            item: item
          };
      }

    case 'turn.started':
      return {
        type: 'turn_started'
      };

    case 'turn.completed':
      return {
        type: 'turn_complete',
        usage: event.usage
      };

    case 'turn.failed':
      return {
        type: 'turn_failed',
        error: event.error
      };

    case 'thread.started':
      return {
        type: 'thread_started',
        threadId: event.id
      };

    case 'error':
      return {
        type: 'error',
        message: event.message
      };

    default:
      return {
        type: event.type,
        data: event
      };
  }
}

/**
 * 将权限模式映射为 Codex SDK 选项
 * @param {string} permissionMode - 'default'、'acceptEdits' 或 'bypassPermissions'
 * @returns {object} - { sandboxMode, approvalPolicy }
 */
function mapPermissionModeToCodexOptions(permissionMode) {
  switch (permissionMode) {
    case 'acceptEdits':
      return {
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never'
      };
    case 'bypassPermissions':
      return {
        sandboxMode: 'danger-full-access',
        approvalPolicy: 'never'
      };
    case 'default':
    default:
      return {
        sandboxMode: 'workspace-write',
        approvalPolicy: 'untrusted'
      };
  }
}

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

  let codex;
  let thread;
  let currentSessionId = sessionId;

  try {
    // 初始化 Codex SDK
    codex = new Codex();

    // 线程选项，包含沙箱和批准设置
    const threadOptions = {
      workingDirectory,
      skipGitRepoCheck: true,
      sandboxMode,
      approvalPolicy,
      model
    };

    // 启动或恢复线程
    if (sessionId) {
      thread = codex.resumeThread(sessionId, threadOptions);
    } else {
      thread = codex.startThread(threadOptions);
    }

    // 获取线程 ID
    currentSessionId = thread.id || sessionId || `codex-${Date.now()}`;

    // 跟踪会话
    activeCodexSessions.set(currentSessionId, {
      thread,
      codex,
      status: 'running',
      startedAt: new Date().toISOString()
    });

    // 发送会话创建事件
    sendMessage(ws, {
      type: 'session-created',
      sessionId: currentSessionId,
      provider: 'codex'
    });

    // 使用流式执行
    const streamedTurn = await thread.runStreamed(command);

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
        const totalTokens = (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0);
        sendMessage(ws, {
          type: 'token-budget',
          data: {
            used: totalTokens,
            total: 200000 // Codex 模型的默认上下文窗口
          }
        });
      }
    }

    // 发送完成事件
    sendMessage(ws, {
      type: 'codex-complete',
      sessionId: currentSessionId,
      actualSessionId: thread.id
    });

  } catch (error) {
    console.error('[Codex] Error:', error);

    sendMessage(ws, {
      type: 'codex-error',
      error: error.message,
      sessionId: currentSessionId
    });

  } finally {
    // 更新会话状态
    if (currentSessionId) {
      const session = activeCodexSessions.get(currentSessionId);
      if (session) {
        session.status = 'completed';
      }
    }
  }
}

/**
 * 中止活动的 Codex 会话
 * @param {string} sessionId - 要中止的会话 ID
 * @returns {boolean} - 中止是否成功
 */
export function abortCodexSession(sessionId) {
  const session = activeCodexSessions.get(sessionId);

  if (!session) {
    return false;
  }

  session.status = 'aborted';

  // SDK 没有直接的中止方法，但标记状态
  // 将导致流式循环退出

  return true;
}

/**
 * 检查会话是否活动
 * @param {string} sessionId - 要检查的会话 ID
 * @returns {boolean} - 会话是否活动
 */
export function isCodexSessionActive(sessionId) {
  const session = activeCodexSessions.get(sessionId);
  return session?.status === 'running';
}

/**
 * 获取所有活动会话
 * @returns {Array} - 活动会话信息数组
 */
export function getActiveCodexSessions() {
  const sessions = [];

  for (const [id, session] of activeCodexSessions.entries()) {
    if (session.status === 'running') {
      sessions.push({
        id,
        status: session.status,
        startedAt: session.startedAt
      });
    }
  }

  return sessions;
}

/**
 * 通过 WebSocket 或 writer 发送消息的辅助函数
 * @param {WebSocket|object} ws - WebSocket 或响应 writer
 * @param {object} data - 要发送的数据
 */
function sendMessage(ws, data) {
  try {
    if (ws.isSSEStreamWriter || ws.isWebSocketWriter) {
      // Writer 处理字符串化（SSEStreamWriter 或 WebSocketWriter）
      ws.send(data);
    } else if (typeof ws.send === 'function') {
      // 原始 WebSocket - 在此处字符串化
      ws.send(JSON.stringify(data));
    }
  } catch (error) {
    console.error('[Codex] Error sending message:', error);
  }
}

// 定期清理旧的已完成会话
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 分钟

  for (const [id, session] of activeCodexSessions.entries()) {
    if (session.status !== 'running') {
      const startedAt = new Date(session.startedAt).getTime();
      if (now - startedAt > maxAge) {
        activeCodexSessions.delete(id);
      }
    }
  }
}, 5 * 60 * 1000); // 每 5 分钟
