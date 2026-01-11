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
import path from 'path';

// PTY 会话存储：sessionId -> sessionInfo
const ptySessions = new Map();

// 活动 PTY 流：sessionId -> stream
const ptyStreams = new Map();

/**
 * 在用户容器内创建 PTY 会话
 * @param {object} ws - WebSocket 连接
 * @param {object} options - PTY 选项
 * @returns {Promise<object>} 会话信息
 */
export async function createPtyInContainer(ws, options) {
  const {
    userId,
    projectPath = '',
    sessionId = uuidv4(),
    initialCommand = 'bash',
    cols = 80,
    rows = 24,
    userTier = 'free'
  } = options;

  try {
    // 1. 获取或创建用户容器
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: userTier
    });

    // 2. 检查会话是否已存在
    if (ptySessions.has(sessionId)) {
      const existingSession = ptySessions.get(sessionId);
      if (existingSession.status === 'active') {
        return existingSession;
      }
    }

    // 3. 构建外壳命令
    const shellCommand = buildShellCommand(projectPath, initialCommand);

    // 4. 使用 TTY 创建 exec
    const exec = await containerManager.docker.getContainer(container.id).exec({
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
    });

    // 5. 启动 exec 流
    const stream = await exec.start({ Detach: false, Tty: true });

    // 6. 创建会话信息
    const sessionInfo = {
      sessionId,
      userId,
      containerId: container.id,
      execId: exec.id,
      status: 'active',
      cols,
      rows,
      projectPath,
      buffer: [],
      bufferSize: 5000,
      createdAt: new Date(),
      lastActive: new Date()
    };

    // 7. 存储会话和流
    ptySessions.set(sessionId, sessionInfo);
    ptyStreams.set(sessionId, { stream, exec, ws });

    // 8. 设置流处理器
    setupStreamHandlers(sessionId, stream, ws);

    // 9. 发送会话启动消息
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'session_started',
        sessionId,
        containerId: container.id,
        message: 'PTY session started in container'
      }));
    }

    return sessionInfo;

  } catch (error) {
    // 向客户端发送错误
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'error',
        sessionId,
        error: `Failed to create PTY: ${error.message}`
      }));
    }

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
 * 为 PTY 会话设置流处理器
 * @param {string} sessionId - 会话 ID
 * @param {object} stream - Docker exec 流
 * @param {object} ws - WebSocket 连接
 */
function setupStreamHandlers(sessionId, stream, ws) {
  // 处理来自容器的输出
  stream.on('data', (data) => {
    const output = data.toString();

    // 更新会话信息
    const session = ptySessions.get(sessionId);
    if (session) {
      session.lastActive = new Date();

      // 添加到缓冲区
      if (session.buffer.length >= session.bufferSize) {
        session.buffer.shift();
      }
      session.buffer.push(output);
    }

    // 发送到 WebSocket
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'output',
        sessionId,
        data: output
      }));
    }
  });

  // 处理流错误
  stream.on('error', (error) => {
    console.error(`PTY stream error for session ${sessionId}:`, error.message);

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'error',
        sessionId,
        error: error.message
      }));
    }

    // 将会话标记为错误
    const session = ptySessions.get(sessionId);
    if (session) {
      session.status = 'error';
      session.error = error.message;
    }
  });

  // 处理流结束
  stream.on('end', () => {
    console.log(`PTY stream ended for session ${sessionId}`);

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'session_ended',
        sessionId
      }));
    }

    // 将会话标记为已结束
    const session = ptySessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endedAt = new Date();
    }
  });

  // 处理 WebSocket 关闭
  ws.on('close', () => {
    cleanupPtySession(sessionId);
  });
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
 * 调整 PTY 会话大小
 * @param {string} sessionId - 会话 ID
 * @param {number} cols - 新列数
 * @param {number} rows - 新行数
 * @returns {Promise<boolean>} 如果成功则为 true
 */
export async function resizePty(sessionId, cols, rows) {
  const session = ptySessions.get(sessionId);

  if (!session) {
    throw new Error(`No PTY session found: ${sessionId}`);
  }

  const sessionData = ptyStreams.get(sessionId);
  if (!sessionData) {
    throw new Error(`No active stream for session: ${sessionId}`);
  }

  try {
    // 更新会话信息
    session.cols = cols;
    session.rows = rows;

    // 注意：Dockerode 不支持在创建后调整 exec 大小
    // 这需要使用新方法实现
    // 目前，我们只是更新存储的维度

    return true;
  } catch (error) {
    throw new Error(`Failed to resize PTY: ${error.message}`);
  }
}

/**
 * 结束 PTY 会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 如果成功则为 true
 */
export async function endPtySession(sessionId) {
  return cleanupPtySession(sessionId);
}

/**
 * 清理 PTY 会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 如果已清理则为 true
 */
async function cleanupPtySession(sessionId) {
  const sessionData = ptyStreams.get(sessionId);
  const session = ptySessions.get(sessionId);

  if (sessionData) {
    const { stream, exec } = sessionData;

    try {
      // 关闭流
      if (stream && !stream.destroyed) {
        stream.destroy();
      }
    } catch (error) {
      console.error(`Error closing stream for session ${sessionId}:`, error.message);
    }

    // 从流映射中移除
    ptyStreams.delete(sessionId);
  }

  if (session) {
    // 将会话标记为已结束
    session.status = 'ended';
    session.endedAt = new Date();

    // 从会话映射中移除
    ptySessions.delete(sessionId);
  }

  return true;
}

/**
 * 获取 PTY 会话信息
 * @param {string} sessionId - 会话 ID
 * @returns {object|undefined} 会话信息
 */
export function getPtySessionInfo(sessionId) {
  return ptySessions.get(sessionId);
}

/**
 * 获取所有活动的 PTY 会话
 * @returns {Array} 活动会话数组
 */
export function getActivePtySessions() {
  return Array.from(ptySessions.values())
    .filter(session => session.status === 'active');
}

/**
 * 按用户 ID 获取 PTY 会话
 * @param {number} userId - 用户 ID
 * @returns {Array} 用户会话数组
 */
export function getPtySessionsByUserId(userId) {
  return Array.from(ptySessions.values())
    .filter(session => session.userId === userId);
}

/**
 * 结束用户的所有 PTY 会话
 * @param {number} userId - 用户 ID
 * @returns {Promise<number>} 已结束会话数
 */
export async function endAllPtySessionsForUser(userId) {
  const sessions = getPtySessionsByUserId(userId);
  let count = 0;

  for (const session of sessions) {
    try {
      await cleanupPtySession(session.sessionId);
      count++;
    } catch (error) {
      console.error(`Failed to end session ${session.sessionId}:`, error.message);
    }
  }

  return count;
}

/**
 * 获取会话缓冲区
 * @param {string} sessionId - 会话 ID
 * @returns {string} 缓冲区内容
 */
export function getPtySessionBuffer(sessionId) {
  const session = ptySessions.get(sessionId);

  if (!session) {
    return '';
  }

  return session.buffer.join('');
}

/**
 * 清理空闲的 PTY 会话
 * @param {number} idleTime - 空闲时间（毫秒）（默认：1 小时）
 * @returns {number} 已清理会话数
 */
export function cleanupIdlePtySessions(idleTime = 60 * 60 * 1000) {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of ptySessions.entries()) {
    const timeSinceActive = now - session.lastActive.getTime();

    if (timeSinceActive > idleTime && session.status === 'active') {
      cleanupPtySession(sessionId);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

// 开始定期清理
setInterval(() => {
  const count = cleanupIdlePtySessions();
  if (count > 0) {
    console.log(`Cleaned up ${count} idle PTY sessions`);
  }
}, 30 * 60 * 1000); // 每 30 分钟
