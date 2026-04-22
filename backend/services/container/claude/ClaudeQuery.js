/**
 * Claude Query Orchestrator
 *
 * Main entry point that coordinates container acquisition, working directory
 * mapping, session management, and execution.
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import containerManager from '../core/index.js';
import { executeInContainer } from './DockerExecutor.js';
import { createSession, updateSession } from './SessionManager.js';
import { CONTAINER } from '../../../config/config.js';
import { memoryService } from '../../memory/index.js';
import { createLogger, sanitizePreview } from '../../../utils/logger.js';
const logger = createLogger('services/container/claude/ClaudeQuery');

// 用于在命令中包装记忆上下文的记忆标记
const MEMORY_START = '--- Memory Context ---';
const MEMORY_END = '--- End Memory Context ---';
const MEMORY_SEPARATOR = '\n';

// 用于解析 SDK 执行的正确工作目录路径的辅助函数
/**
 * 映射工作目录
 * @param {boolean} isContainerProject - 是否为容器项目
 * @param {string} projectPath - 项目路径（如 "my-workspace"）
 * @param {string} cwd - 当前工作目录
 * @returns {string} 映射后的工作目录
 *
 * 注意：根据文档设计（docs/arch/data-storage-design.md）：
 * - 项目代码目录：/workspace/my-workspace/ （实际的项目代码）
 * - Claude 元数据：/workspace/.claude/projects/my-workspace/ （会话历史）
 * - SDK 需要在项目代码目录中运行（cwd: /workspace/my-workspace）
 */
function mapWorkingDirectory(isContainerProject, projectPath, cwd) {
  if (isContainerProject && projectPath) {
    // 容器项目：项目代码直接在 /workspace 下，不在 .claude/projects 下
    // 例如：my-workspace -> /workspace/my-workspace
    return `${CONTAINER.paths.workspace}/${projectPath}`.replace(/\/+/g, '/');
  } else if (cwd) {
    // 工作空间文件：提取基本名称并使用 /workspace
    return `${CONTAINER.paths.workspace}/${path.basename(cwd)}`.replace(/\/+/g, '/');
  } else {
    return CONTAINER.paths.workspace;
  }
}

// 加载用户的记忆文件以作为 Claude 对话的上下文包含在内
/**
 * 加载记忆内容
 * @param {number} userId - 用户 ID
 * @param {object} options - 选项
 * @returns {Promise<string|null>} 记忆内容，如果没有记忆则返回 null
 */
async function loadMemoryContext(userId, options) {
  try {
    const memoryResult = await memoryService.readMemory(userId, {
      containerMode: options.containerMode
    });

    if (memoryResult && memoryResult.content) {
      // 返回原始记忆内容，不添加标记
      return memoryResult.content;
    }
  } catch (error) {
    // 如果读取记忆失败，记录警告但继续执行
    logger.warn('[ClaudeQuery] Failed to load memory context:', error.message);
  }
  return null;
}

// 为 SDK 执行将记忆上下文前置到用户命令
/**
 * 构建增强命令（添加记忆上下文）
 * @param {string} command - 原始命令
 * @param {string|null} memoryContext - 记忆上下文
 * @returns {string} 增强后的命令
 */
function buildEnhancedCommand(command, memoryContext) {
  if (!memoryContext) {
    return command;
  }

  // Add memory to command at execution time
  return `${command}${MEMORY_SEPARATOR}${MEMORY_SEPARATOR}${MEMORY_START}${MEMORY_SEPARATOR}${memoryContext}${MEMORY_SEPARATOR}${MEMORY_END}${MEMORY_SEPARATOR}${MEMORY_SEPARATOR}`;
}

// 通知前端会话启动并在 UI 中包含记忆上下文
/**
 * 发送会话启动和记忆上下文消息
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @param {string} containerId - 容器 ID
 * @param {string|null} memoryContext - 记忆上下文
 */
function sendSessionStart(writer, sessionId, containerId, memoryContext) {
  if (!writer) return;

  // 发送记忆上下文消息（如果有）
  if (memoryContext) {
    logger.debug({ sessionId, memoryLength: memoryContext.length }, '[ClaudeQuery] Sending memory-context');
    writer.send({
      type: 'memory-context',
      sessionId,
      content: memoryContext
    });
  }

  // 发送初始消息
  logger.debug({ sessionId }, '[ClaudeQuery] Sending session_start');
  writer.send({
    type: 'session_start',
    sessionId,
    containerId: containerId,
    message: 'Starting containerized Claude session...'
  });
}

// 查询失败的集中错误处理程序
/**
 * 处理查询错误
 * @param {object} writer - WebSocket 写入器
 * @param {string} sessionId - 会话 ID
 * @param {Error} error - 错误对象
 */
function handleQueryError(writer, sessionId, error) {
  updateSession(sessionId, {
    status: 'error',
    error: error.message,
    endTime: Date.now()
  });

  if (writer) {
    writer.send({
      type: 'error',
      sessionId,
      error: error.message
    });
  }
}

// 在 SessionManager 中注册会话以进行跟踪和中止功能
/**
 * 创建并配置会话
 * @param {string} sessionId - 会话 ID
 * @param {object} container - 容器对象
 * @param {string} command - 用户命令
 * @param {object} mappedOptions - 映射后的选项
 */
function setupSession(sessionId, container, command, mappedOptions) {
  createSession(sessionId, {
    userId: mappedOptions.userId,
    containerId: container.id,
    command: command,
    options: mappedOptions
  });
  logger.info({ sessionId }, '[ClaudeQuery] Session created');
}

// 由 /api/claude/chat WebSocket 处理程序调用的主入口点
/**
 * 在用户容器内执行 Claude SDK 查询
 * @param {string} command - 用户命令
 * @param {object} options - 执行选项
 * @param {object} writer - 用于流式传输的 WebSocket 写入器
 * @returns {Promise<string>} 会话 ID
 */
export async function queryClaudeSDKInContainer(command, options = {}, writer) {
  const {
    userId,
    sessionId = uuidv4(),
    cwd,
    userTier = 'free',
    isContainerProject = false,
    projectPath = '',
    ...sdkOptions
  } = options;

  logger.info({ sessionId, userId }, '[ClaudeQuery] Query started');
  logger.debug({ sessionId, preview: sanitizePreview(command), totalLength: command?.length || 0 }, '[ClaudeQuery] User command');
  logger.debug({ sessionId, isContainerProject, projectPath }, '[ClaudeQuery] Project context');

  try {
    // 1. 加载记忆上下文
    const memoryContext = await loadMemoryContext(userId, {
      containerMode: options.containerMode
    });
    logger.info({ sessionId, memoryLength: memoryContext?.length || 0 }, '[ClaudeQuery] Memory context loaded');

    // 2. 获取或创建用户容器
    logger.debug({ sessionId, userId }, '[ClaudeQuery] Getting container for user');
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: userTier
    });
    logger.info({ sessionId, containerName: container.name }, '[ClaudeQuery] Container obtained');

    // 3. 映射工作目录
    const workingDir = mapWorkingDirectory(isContainerProject, projectPath, cwd);
    logger.debug({ sessionId, workingDir }, '[ClaudeQuery] Working directory mapped');

    // 传递 cwd 给 SDK，但 SDK 脚本会使用它来设置 HOME 环境变量
    // 这样 SDK 会在正确的项目目录下创建会话文件，而不会影响子进程的模块查找
    const mappedOptions = {
      ...sdkOptions,
      sessionId,
      userId,
      cwd: workingDir
    };

    // 4. 创建会话
    setupSession(sessionId, container, command, mappedOptions);

    // 5. 发送会话启动和记忆上下文消息
    sendSessionStart(writer, sessionId, container.id, memoryContext);

    // 6. 构建增强命令并执行
    const enhancedCommand = buildEnhancedCommand(command, memoryContext);
    logger.debug({ sessionId }, '[ClaudeQuery] Executing in container');
    await executeInContainer(userId, enhancedCommand, mappedOptions, writer, sessionId);
    logger.info({ sessionId }, '[ClaudeQuery] Execution completed');

    // 7. 更新会话状态
    updateSession(sessionId, {
      status: 'completed',
      endTime: Date.now()
    });

    return sessionId;

  } catch (error) {
    handleQueryError(writer, sessionId, error);
    throw error;
  }
}

