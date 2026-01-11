/**
 * Claude 查询编排器
 * 
 * 主入口模块，协调容器获取、工作目录映射、会话管理和执行。
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import containerManager from '../core/index.js';
import { executeInContainer } from './DockerExecutor.js';
import { createSession, updateSession } from './SessionManager.js';
import { CONTAINER } from '../../../config/config.js';

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
 * 在用户容器内执行 Claude SDK 查询
 * @param {string} command - 用户命令
 * @param {object} options - 执行选项
 * @param {object} writer - 用于流式传输的 WebSocket 写入器
 * @returns {Promise<string>} 会话 ID
 */
export async function queryClaudeSDKInContainer(command, options = {}, writer) {
  console.log('[ClaudeQuery] Query started');
  console.log('[ClaudeQuery] Command:', command);

  const {
    userId,
    sessionId = uuidv4(),
    cwd,
    userTier = 'free',
    isContainerProject = false,
    projectPath = '',
    ...sdkOptions
  } = options;

  console.log('[ClaudeQuery] userId:', userId, 'sessionId:', sessionId);
  console.log('[ClaudeQuery] isContainerProject:', isContainerProject, 'projectPath:', projectPath);

  try {
    // 1. 获取或创建用户容器
    console.log('[ClaudeQuery] Getting container for user:', userId);
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: userTier
    });
    console.log('[ClaudeQuery] Container obtained:', container.name);

    // 2. 映射工作目录
    const workingDir = mapWorkingDirectory(isContainerProject, projectPath, cwd);
    console.log('[ClaudeQuery] Working directory (mapped):', workingDir);

    // 传递 cwd 给 SDK，但 SDK 脚本会使用它来设置 HOME 环境变量
    // 这样 SDK 会在正确的项目目录下创建会话文件，而不会影响子进程的模块查找
    const mappedOptions = {
      ...sdkOptions,
      sessionId,
      userId,
      cwd: workingDir
    };

    // 3. 创建会话
    createSession(sessionId, {
      userId,
      containerId: container.id,
      command,
      options: mappedOptions
    });
    console.log('[ClaudeQuery] Session created:', sessionId);

    // 4. 发送初始消息
    if (writer) {
      console.log('[ClaudeQuery] Sending session_start');
      writer.send({
        type: 'session_start',
        sessionId,
        containerId: container.id,
        message: 'Starting containerized Claude session...'
      });
    }

    // 5. 执行查询
    console.log('[ClaudeQuery] Executing in container...');
    await executeInContainer(
      userId,
      command,
      mappedOptions,
      writer,
      sessionId
    );
    console.log('[ClaudeQuery] Execution completed');

    // 6. 更新会话状态
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

