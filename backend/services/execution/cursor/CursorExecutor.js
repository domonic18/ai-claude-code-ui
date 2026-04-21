/**
 * Cursor CLI 执行器
 *
 * 负责启动和管理 Cursor CLI（`cursor-agent`）进程，实现 AI 辅助编码。
 * 处理完整的进程生命周期：启动、stdout 解析、通过 WebSocket 路由响应、
 * 优雅关闭/中止。
 *
 * ## 架构说明
 * - Unix 使用 `child_process.spawn`，Windows 使用 `cross-spawn` 以保证兼容性
 * - 通过 sessionId 为键的 Map 维护活跃进程，用于生命周期管理
 * - 响应类型路由委托给 `cursorResponseHandlers`
 *
 * @module services/execution/cursor/CursorExecutor
 */

import { spawn } from 'child_process';
import crossSpawn from 'cross-spawn';
import { createLogger, sanitizePreview } from '../../../utils/logger.js';
import { createResponseHandlers } from './cursorResponseHandlers.js';

const logger = createLogger('services/execution/cursor/CursorExecutor');

/** 平台适配的 spawn 函数：cross-spawn 处理 Windows 路径兼容问题 */
const spawnFunction = process.platform === 'win32' ? crossSpawn : spawn;

/** 以 sessionId 为键追踪正在运行的 cursor-agent 进程，用于中止/查询 */
const activeCursorProcesses = new Map();

/**
 * 构建 cursor-agent 的 CLI 参数列表
 *
 * @param {string} command - 用户发送给 Cursor 的提示词
 * @param {string} [sessionId] - 已有会话 ID（用于恢复会话），新会话时为 null
 * @param {string} [model] - 模型标识符（仅对新会话生效）
 * @param {boolean} skipPermissions - 请求级别标志，跳过权限确认提示
 * @param {Object} settings - 项目配置中的全局工具设置
 * @param {boolean} settings.skipPermissions - 配置级别标志，跳过权限确认
 * @returns {string[]} CLI 参数数组
 */
function buildCursorArgs(command, sessionId, model, skipPermissions, settings) {
  const args = [];

  // 恢复已有会话时传入 --resume 参数
  if (sessionId) args.push('--resume=' + sessionId);
  if (command && command.trim()) {
    args.push('-p', command);
    // 模型选择仅对新会话生效；恢复的会话保留原有模型
    if (!sessionId && model) args.push('--model', model);
    // 使用流式 JSON 格式，便于实时解析增量响应
    args.push('--output-format', 'stream-json');
  }
  // -f 标志自动批准所有工具使用的权限确认提示
  if (skipPermissions || settings.skipPermissions) {
    args.push('-f');
    logger.info({ sessionId }, '[CursorExecutor] Using -f flag (skip permissions)');
  }

  return args;
}

/** 预构建的响应处理器映射，按 response.type 路由 stdout 事件 */
const RESPONSE_HANDLERS = createResponseHandlers(activeCursorProcesses, logger);

/**
 * 解析并路由 cursor-agent 输出的一行 stdout
 *
 * 每行预期为带有 `type` 字段的 JSON 对象。若 type 匹配已注册的处理器则分发；
 * 否则将原始响应作为 `cursor-response` 转发给客户端。
 *
 * @param {string} line - CLI 进程的原始 stdout 行
 * @param {Object} context - 在整个管道中传递的执行上下文
 * @param {string} context.sessionId - 原始会话标识符
 * @param {string} context.capturedSessionId - 可能与 sessionId 不同（CLI 生成了新会话 ID 时）
 * @param {Object} context.ws - 与前端客户端的 WebSocket 连接
 */
function processStdoutLine(line, context) {
  try {
    const response = JSON.parse(line);
    logger.debug({ sessionId: context.sessionId, responseType: response.type, subtype: response.subtype }, '[CursorExecutor] Parsed response');
    // 按类型分发到对应处理器（如 assistant、system），未匹配则原样转发
    const handler = RESPONSE_HANDLERS[response.type];
    if (handler) handler(response, context);
    else context.ws.send({ type: 'cursor-response', data: response });
  } catch {
    // 非 JSON 行（如进度指示器）作为纯文本输出发送
    logger.debug({ sessionId: context.sessionId, lineLength: line.length }, '[CursorExecutor] Non-JSON response');
    context.ws.send({ type: 'cursor-output', data: line });
  }
}

/**
 * 启动 cursor-agent 进程并将结果流式传输到 WebSocket 客户端
 *
 * 管理完整生命周期：构建 CLI 参数 → 启动进程 → 绑定 stdout/stderr/close
 * 处理器 → 进程退出时 resolve/reject Promise。
 *
 * @param {string} command - 要执行的用户提示词
 * @param {Object} [options] - 执行选项
 * @param {string} [options.sessionId] - 恢复已有会话
 * @param {string} [options.projectPath] - 项目根路径（cwd 的备选）
 * @param {string} [options.cwd] - 被启动进程的工作目录
 * @param {Object} [options.toolsSettings] - 允许的 shell 命令和权限设置
 * @param {boolean} [options.skipPermissions] - 跳过所有工具权限确认提示
 * @param {string} [options.model] - 新会话使用的模型
 * @param {Object} ws - 具有 `.send()` 方法的 WebSocket 连接
 * @returns {Promise<void>} 正常退出（code 0）时 resolve，否则 reject
 */
async function spawnCursor(command, options = {}, ws) {
  return new Promise(async (resolve, reject) => {
    const { sessionId, projectPath, cwd, toolsSettings, skipPermissions, model } = options;
    const settings = toolsSettings || { allowedShellCommands: [], skipPermissions: false };
    const workingDir = cwd || projectPath || process.cwd();

    const args = buildCursorArgs(command, sessionId, model, skipPermissions, settings);
    logger.info({ sessionId, workingDir, resume: !!sessionId }, '[CursorExecutor] Spawning Cursor CLI');
    logger.debug({ sessionId, commandPreview: sanitizePreview(command), totalLength: command?.length || 0 }, '[CursorExecutor] User command');

    const cursorProcess = spawnFunction('cursor-agent', args, { cwd: workingDir, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });

    // 使用 sessionId 或时间戳作为进程追踪键（新会话场景）
    const processKey = sessionId || Date.now().toString();
    activeCursorProcesses.set(processKey, cursorProcess);

    // 该进程所有流处理器共享的上下文对象
    const context = {
      sessionId, capturedSessionId: sessionId, sessionCreatedSent: false,
      messageBuffer: '', processKey, cursorProcess, ws,
    };

    // 将 stdout 行流式送入响应解析器
    cursorProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines) processStdoutLine(line, context);
    });

    // 将 stderr 作为错误事件转发给客户端
    cursorProcess.stderr.on('data', (data) => {
      logger.error({ sessionId: context.capturedSessionId || sessionId, stderr: data.toString().substring(0, 500) }, '[CursorExecutor] stderr');
      ws.send({ type: 'cursor-error', error: data.toString() });
    });

    // 进程退出时：清理追踪、通知客户端、resolve/reject Promise
    cursorProcess.on('close', async (code) => {
      const finalSessionId = context.capturedSessionId || processKey;
      logger.info({ sessionId: finalSessionId, exitCode: code }, '[CursorExecutor] Process exited');
      activeCursorProcesses.delete(finalSessionId);
      ws.send({ type: 'claude-complete', sessionId: finalSessionId, exitCode: code, isNewSession: !sessionId && !!command });
      code === 0 ? resolve() : reject(new Error(`Cursor CLI exited with code ${code}`));
    });

    // 处理启动失败（如 cursor-agent 未在 PATH 中找到）
    cursorProcess.on('error', (error) => {
      const finalSessionId = context.capturedSessionId || processKey;
      logger.error({ sessionId: finalSessionId, err: error }, '[CursorExecutor] Process error');
      activeCursorProcesses.delete(finalSessionId);
      ws.send({ type: 'cursor-error', error: error.message });
      reject(error);
    });

    // 立即关闭 stdin — cursor-agent 通过 -p 参数读取提示词，不从 stdin 读取
    cursorProcess.stdin.end();
  });
}

/**
 * 通过发送 SIGTERM 终止正在运行的 cursor-agent 会话
 *
 * @param {string} sessionId - 要中止的会话标识符
 * @returns {boolean} 找到并终止进程返回 true，否则返回 false
 */
function abortCursorSession(sessionId) {
  const process = activeCursorProcesses.get(sessionId);
  if (process) {
    logger.info({ sessionId }, '[CursorExecutor] Aborting session');
    process.kill('SIGTERM');
    activeCursorProcesses.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * 检查指定会话的 cursor-agent 进程是否正在运行
 *
 * @param {string} sessionId - 要检查的会话标识符
 * @returns {boolean}
 */
function isCursorSessionActive(sessionId) {
  return activeCursorProcesses.has(sessionId);
}

/**
 * 获取所有当前活跃的 cursor-agent 会话 ID 列表
 *
 * @returns {string[]} 活跃会话 ID 数组
 */
function getActiveCursorSessions() {
  return Array.from(activeCursorProcesses.keys());
}

export { spawnCursor, abortCursorSession, isCursorSessionActive, getActiveCursorSessions };
