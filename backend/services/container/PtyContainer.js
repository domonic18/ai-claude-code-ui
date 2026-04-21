/**
 * PTY 容器集成
 *
 * PTY（伪终端）处理的容器化版本。
 * 在用户隔离的 Docker 容器内创建终端会话。
 *
 * 主要功能：
 * - 容器隔离的 PTY 会话
 * - 会话管理和清理
 * - WebSocket 通信
 * - 终端缓冲区管理
 */

import containerManager from './core/index.js';
import { v4 as uuidv4 } from 'uuid';
import { PTY_TIMEOUTS } from '../../config/config.js';
import { createLogger } from '../../utils/logger.js';
import { setupStreamHandlers } from './ptyStreamHandlers.js';
import {
  cleanupPtySession,
  getPtySessionInfoHelper,
  getActivePtySessionsHelper,
  getPtySessionsByUserIdHelper,
  endAllPtySessionsForUserHelper,
  getPtySessionBufferHelper,
  cleanupIdlePtySessionsHelper
} from './ptySessionManagement.js';

const logger = createLogger('services/container/PtyContainer');

// PTY 会话存储：sessionId -> sessionInfo
const ptySessions = new Map();

// 活动 PTY 流：sessionId -> stream
const ptyStreams = new Map();

/**
 * 构建 PTY exec 配置
 * @param {string} shellCommand - Shell 命令
 * @param {number} cols - 终端列数
 * @param {number} rows - 终端行数
 * @returns {Object} Docker exec 配置
 */
function buildPtyExecConfig(shellCommand, cols, rows) {
  return {
    Cmd: ['/bin/bash', '-c', shellCommand],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    WorkingDir: '/workspace',
    Env: [
      'TERM=xterm-256color',
      'COLORTERM=truecolor',
      `COLUMNS=${cols}`,
      `LINES=${rows}`,
      'FORCE_COLOR=3'
    ]
  };
}

/**
 * 创建 PTY 会话信息对象
 * @param {Object} params - 会话参数
 * @returns {Object} 会话信息
 */
function createPtySessionInfo({ sessionId, userId, containerId, execId, cols, rows, projectPath }) {
  return {
    sessionId,
    userId,
    containerId,
    execId,
    status: 'active',
    cols,
    rows,
    projectPath,
    buffer: [],
    bufferSize: 5000,
    createdAt: new Date(),
    lastActive: new Date()
  };
}

/**
 * 通过 WebSocket 发送 JSON 消息（仅当连接就绪时）
 * @param {object} ws - WebSocket 连接
 * @param {Object} message - 要发送的消息对象
 */
function sendWsMessage(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * 获取已有的活动会话（如果存在）
 * @param {string} sessionId - 会话 ID
 * @returns {Object|null} 已存在的会话信息，或 null
 */
function getExistingActiveSession(sessionId) {
  const existing = ptySessions.get(sessionId);
  if (existing && existing.status === 'active') return existing;
  return null;
}

/**
 * 在容器中创建并启动 exec 流
 * @param {Object} container - Docker 容器实例
 * @param {string} shellCommand - Shell 命令
 * @param {number} cols - 列数
 * @param {number} rows - 行数
 * @returns {Promise<{ exec: Object, stream: Object }>} exec 和 stream
 */
async function startContainerExec(container, shellCommand, cols, rows) {
  const exec = await containerManager.docker.getContainer(container.id).exec(buildPtyExecConfig(shellCommand, cols, rows));
  const stream = await exec.start({ Detach: false, Tty: true });
  return { exec, stream };
}

/**
 * 注册并初始化新的 PTY 会话
 * @param {Object} params - 会话参数
 * @returns {Object} 会话信息
 */
function registerNewSession({ sessionId, userId, container, exec, stream, ws, cols, rows, projectPath }) {
  const sessionInfo = createPtySessionInfo({
    sessionId, userId, containerId: container.id, execId: exec.id, cols, rows, projectPath
  });
  ptySessions.set(sessionId, sessionInfo);
  ptyStreams.set(sessionId, { stream, exec, ws });
  setupStreamHandlers(sessionId, stream, ws, ptySessions, (id) => cleanupPtySession(id, ptyStreams, ptySessions));
  sendWsMessage(ws, {
    type: 'session_started', sessionId,
    containerId: container.id, message: 'PTY session started in container'
  });
  return sessionInfo;
}

/** PTY 会话默认配置 */
const PTY_DEFAULTS = {
  projectPath: '',
  sessionId: null,
  initialCommand: 'bash',
  cols: 80,
  rows: 24,
  userTier: 'free'
};

/**
 * 解析 PTY 选项并设置默认值
 * @param {object} options - 原始选项
 * @returns {Object} 完整选项
 */
function resolvePtyOptions(options) {
  const merged = { ...PTY_DEFAULTS, ...options };
  merged.sessionId = merged.sessionId || uuidv4();
  return merged;
}

/**
 * 在用户容器内创建 PTY 会话
 * @param {object} ws - WebSocket 连接
 * @param {object} options - PTY 选项
 * @returns {Promise<object>} 会话信息
 */
export async function createPtyInContainer(ws, options) {
  const { userId, projectPath, sessionId, initialCommand, cols, rows, userTier } = resolvePtyOptions(options);

  try {
    const existing = getExistingActiveSession(sessionId);
    if (existing) return existing;

    const container = await containerManager.getOrCreateContainer(userId, { tier: userTier });
    const shellCommand = buildShellCommand(projectPath, initialCommand);
    const { exec, stream } = await startContainerExec(container, shellCommand, cols, rows);

    return registerNewSession({ sessionId, userId, container, exec, stream, ws, cols, rows, projectPath });
  } catch (error) {
    sendWsMessage(ws, { type: 'error', sessionId, error: `Failed to create PTY: ${error.message}` });
    throw error;
  }
}

/**
 * 构建用于容器执行的外壳命令
 * @param {string} projectPath - 项目路径（可选）
 * @param {string} initialCommand - 要运行的初始命令
 * @returns {string} 完整的外壳命令
 */
function buildShellCommand(projectPath, initialCommand) {
  let command = '';

  // 如果指定了项目路径，则更改到项目目录
  if (projectPath) {
    const workspaceProjectPath = projectPath.replace(/^.*:/, '/workspace');
    command += `cd "${workspaceProjectPath}" && `;
  }

  // 运行初始命令或默认外壳
  command += initialCommand || 'bash';

  return command;
}

/**
 * 向容器 PTY 发送输入
 * @param {string} sessionId - 会话 ID
 * @param {string} input - 要发送的输入
 * @returns {Promise<boolean>} 如果成功则为 true
 */
export async function sendInputToPty(sessionId, input) {
  const sessionData = ptyStreams.get(sessionId);

  if (!sessionData) {
    throw new Error(`No active PTY session found: ${sessionId}`);
  }

  const { stream } = sessionData;

  try {
    stream.write(input);
    return true;
  } catch (error) {
    throw new Error(`Failed to send input to PTY: ${error.message}`);
  }
}

/**
 * 验证并获取 PTY 会话数据
 * @param {string} sessionId - 会话 ID
 * @returns {{ session: Object, sessionData: Object }} 会话和流数据
 * @throws {Error} 如果会话不存在
 */
function requirePtySession(sessionId) {
  const session = ptySessions.get(sessionId);
  if (!session) throw new Error(`No PTY session found: ${sessionId}`);
  const sessionData = ptyStreams.get(sessionId);
  if (!sessionData) throw new Error(`No active stream for session: ${sessionId}`);
  return { session, sessionData };
}

/**
 * 调整 PTY 会话大小
 * @param {string} sessionId - 会话 ID
 * @param {number} cols - 新列数
 * @param {number} rows - 新行数
 * @returns {Promise<boolean>} 如果成功则为 true
 */
export async function resizePty(sessionId, cols, rows) {
  const { session } = requirePtySession(sessionId);
  session.cols = cols;
  session.rows = rows;
  return true;
}

/**
 * 结束 PTY 会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 如果成功则为 true
 */
export async function endPtySession(sessionId) {
  return cleanupPtySession(sessionId, ptyStreams, ptySessions);
}

/**
 * 获取 PTY 会话信息
 * @param {string} sessionId - 会话 ID
 * @returns {object|undefined} 会话信息
 */
export function getPtySessionInfo(sessionId) {
  return getPtySessionInfoHelper(sessionId, ptySessions);
}

/**
 * 获取所有活动的 PTY 会话
 * @returns {Array} 活动会话数组
 */
export function getActivePtySessions() {
  return getActivePtySessionsHelper(ptySessions);
}

/**
 * 按用户 ID 获取 PTY 会话
 * @param {number} userId - 用户 ID
 * @returns {Array} 用户会话数组
 */
export function getPtySessionsByUserId(userId) {
  return getPtySessionsByUserIdHelper(userId, ptySessions);
}

/**
 * 结束用户的所有 PTY 会话
 * @param {number} userId - 用户 ID
 * @returns {Promise<number>} 已结束会话数
 */
export async function endAllPtySessionsForUser(userId) {
  return endAllPtySessionsForUserHelper(userId, ptySessions, ptyStreams);
}

/**
 * 获取会话缓冲区
 * @param {string} sessionId - 会话 ID
 * @returns {string} 缓冲区内容
 */
export function getPtySessionBuffer(sessionId) {
  return getPtySessionBufferHelper(sessionId, ptySessions);
}

/**
 * 清理空闲的 PTY 会话
 * @param {number} idleTime - 空闲时间（毫秒）（默认：使用配置值）
 * @returns {number} 已清理会话数
 */
export function cleanupIdlePtySessions(idleTime = PTY_TIMEOUTS.idleCleanup) {
  return cleanupIdlePtySessionsHelper(ptySessions, ptyStreams, idleTime);
}

// 开始定期清理
setInterval(() => {
  const count = cleanupIdlePtySessions();
  if (count > 0) {
    logger.info(`Cleaned up ${count} idle PTY sessions`);
  }
}, PTY_TIMEOUTS.cleanupInterval); // 使用配置的清理间隔
