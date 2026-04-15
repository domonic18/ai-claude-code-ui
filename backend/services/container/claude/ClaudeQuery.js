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
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/container/claude/ClaudeQuery');

// Memory markers used to wrap memory context in commands
const MEMORY_START = '--- Memory Context ---';
const MEMORY_END = '--- End Memory Context ---';
const MEMORY_SEPARATOR = '\n';

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

/**
 * 在用户容器内执行 Claude SDK 查询
 * @param {string} command - 用户命令
 * @param {object} options - 执行选项
 * @param {object} writer - 用于流式传输的 WebSocket 写入器
 * @returns {Promise<string>} 会话 ID
 */
export async function queryClaudeSDKInContainer(command, options = {}, writer) {
  logger.info('[ClaudeQuery] Query started');
  logger.info('[ClaudeQuery] Command:', command);

  const {
    userId,
    sessionId = uuidv4(),
    cwd,
    userTier = 'free',
    isContainerProject = false,
    projectPath = '',
    ...sdkOptions
  } = options;

  logger.info('[ClaudeQuery] userId:', userId, 'sessionId:', sessionId);
  logger.info('[ClaudeQuery] isContainerProject:', isContainerProject, 'projectPath:', projectPath);

  try {
    // 1. 加载记忆上下文
    const memoryContext = await loadMemoryContext(userId, {
      containerMode: options.containerMode
    });
    logger.info('[ClaudeQuery] Memory context loaded:', memoryContext ? `${memoryContext.length} chars` : 'none');

    // 2. 获取或创建用户容器
    logger.info('[ClaudeQuery] Getting container for user:', userId);
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: userTier
    });
    logger.info('[ClaudeQuery] Container obtained:', container.name);

    // 3. 映射工作目录
    const workingDir = mapWorkingDirectory(isContainerProject, projectPath, cwd);
    logger.info('[ClaudeQuery] Working directory (mapped):', workingDir);

    // 传递 cwd 给 SDK，但 SDK 脚本会使用它来设置 HOME 环境变量
    // 这样 SDK 会在正确的项目目录下创建会话文件，而不会影响子进程的模块查找
    const mappedOptions = {
      ...sdkOptions,
      sessionId,
      userId,
      cwd: workingDir
    };

    // 4. 创建会话
    createSession(sessionId, {
      userId,
      containerId: container.id,
      command: command,
      options: mappedOptions
    });
    logger.info('[ClaudeQuery] Session created:', sessionId);

    // 5. 发送记忆上下文消息（如果有）
    if (writer && memoryContext) {
      logger.info('[ClaudeQuery] Sending memory-context');
      writer.send({
        type: 'memory-context',
        sessionId,
        content: memoryContext
      });
    }

    // 6. 发送初始消息
    if (writer) {
      logger.info('[ClaudeQuery] Sending session_start');
      writer.send({
        type: 'session_start',
        sessionId,
        containerId: container.id,
        message: 'Starting containerized Claude session...'
      });
    }

    // 7. Build enhanced command (original command + memory context) and execute
    let enhancedCommand = command;
    if (memoryContext) {
      // Add memory to command at execution time
      enhancedCommand = `${command}${MEMORY_SEPARATOR}${MEMORY_SEPARATOR}${MEMORY_START}${MEMORY_SEPARATOR}${memoryContext}${MEMORY_SEPARATOR}${MEMORY_END}${MEMORY_SEPARATOR}${MEMORY_SEPARATOR}`;
    }
    logger.info('[ClaudeQuery] Executing in container...');
    await executeInContainer(
      userId,
      enhancedCommand,
      mappedOptions,
      writer,
      sessionId
    );
    logger.info('[ClaudeQuery] Execution completed');

    // 8. 更新会话状态
    updateSession(sessionId, {
      status: 'completed',
      endTime: Date.now()
    });

    return sessionId;

  } catch (error) {
    // 出错时更新会话状态
    updateSession(sessionId, {
      status: 'error',
      error: error.message,
      endTime: Date.now()
    });

    // 发送错误消息
    if (writer) {
      writer.send({
        type: 'error',
        sessionId,
        error: error.message
      });
    }

    throw error;
  }
}

