/**
 * ContainerExecutionEngine.js
 *
 * 容器执行引擎
 * 在 Docker 容器中执行 Claude SDK 调用
 *
 * @module execution/engines/ContainerExecutionEngine
 */

import { BaseExecutionEngine } from './BaseExecutionEngine.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import containerManager from '../../container/core/index.js';
import { executeInContainer } from '../../container/claude/DockerExecutor.js';
import { createSession, updateSession } from '../../container/claude/SessionManager.js';
import { CONTAINER } from '../../../config/config.js';

/**
 * 容器执行引擎
 * 在用户专属的 Docker 容器中执行 Claude SDK 调用
 */
export class ContainerExecutionEngine extends BaseExecutionEngine {
  /**
   * 构造函数
   * @param {Object} config - 引擎配置
   */
  constructor(config = {}) {
    super({
      name: 'ContainerExecutionEngine',
      version: '1.0.0',
      ...config
    });
    this.engineType = 'container';
    this.requiresUserId = true;
  }

  /**
   * 执行 Claude 命令（容器模式）
   * @param {string} command - 用户命令
   * @param {Object} options - 执行选项
   * @param {Object} writer - WebSocket 写入器
   * @returns {Promise<{sessionId: string}>}
   */
  async execute(command, options = {}, writer) {
    const {
      userId,
      sessionId = uuidv4(),
      cwd,
      userTier = 'free',
      isContainerProject = false,
      projectPath = '',
      ...sdkOptions
    } = options;

    try {
      // 验证选项
      const validation = this._validateOptions(options);
      if (!validation.valid) {
        throw new Error(`Invalid options: ${validation.errors.join(', ')}`);
      }

      // 获取或创建用户容器
      const container = await containerManager.getOrCreateContainer(userId, {
        tier: userTier
      });

      // 映射工作目录
      const workingDir = this._mapWorkingDirectory(isContainerProject, projectPath, cwd);

      // 准备传递给容器的选项
      const mappedOptions = {
        ...sdkOptions,
        sessionId,
        userId,
        cwd: workingDir
      };

      // 创建会话
      createSession(sessionId, {
        userId,
        containerId: container.id,
        command,
        options: mappedOptions
      });

      // 在内部引擎中跟踪会话
      this._addSession(sessionId, {
        userId,
        containerId: container.id,
        command
      });

      // 发送初始消息
      if (writer) {
        writer.send({
          type: 'session_start',
          sessionId,
          containerId: container.id,
          message: 'Starting containerized Claude session...'
        });
      }

      // 在容器中执行
      await executeInContainer(
        userId,
        command,
        mappedOptions,
        writer,
        sessionId
      );

      // 更新会话状态
      updateSession(sessionId, {
        status: 'completed',
        endTime: Date.now()
      });

      this._updateSession(sessionId, { status: 'completed' });
      this._removeSession(sessionId);

      return { sessionId };

    } catch (error) {
      // 错误时更新会话
      updateSession(sessionId, {
        status: 'error',
        error: error.message,
        endTime: Date.now()
      });

      this._updateSession(sessionId, { status: 'error', error: error.message });
      this._removeSession(sessionId);

      // 发送错误消息
      if (writer) {
        writer.send({
          type: 'error',
          sessionId,
          error: this._standardizeError(error)
        });
      }

      throw error;
    }
  }

  /**
   * 中止会话
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>}
   */
  async abort(sessionId) {
    const session = this._getSession(sessionId);

    if (!session) {
      return false;
    }

    try {
      // 更新会话状态
      updateSession(sessionId, {
        status: 'aborted',
        endTime: Date.now()
      });

      this._updateSession(sessionId, { status: 'aborted' });
      this._removeSession(sessionId);

      // TODO: 通知容器中止执行
      // 需要在容器中实现中止机制

      return true;
    } catch (error) {
      console.error(`Error aborting session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 映射工作目录到容器路径
   * @private
   * @param {boolean} isContainerProject - 是否为容器项目
   * @param {string} projectPath - 项目路径
   * @param {string} cwd - 当前工作目录
   * @returns {string} 映射后的工作目录
   */
  _mapWorkingDirectory(isContainerProject, projectPath, cwd) {
    if (isContainerProject && projectPath) {
      // 容器项目：项目代码在 /workspace 下
      return `${CONTAINER.paths.workspace}/${projectPath}`.replace(/\/+/g, '/');
    } else if (cwd) {
      // 工作空间文件：使用基本名称
      return `${CONTAINER.paths.workspace}/${path.basename(cwd)}`.replace(/\/+/g, '/');
    } else {
      return CONTAINER.paths.workspace;
    }
  }
}

export default ContainerExecutionEngine;
