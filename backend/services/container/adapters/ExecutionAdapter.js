/**
 * ExecutionAdapter.js
 *
 * 容器执行适配器
 * 将容器执行操作适配到统一执行引擎接口
 *
 * @module container/adapters/ExecutionAdapter
 */

import containerManager from '../core/index.js';
import { CONTAINER } from '../../../config/config.js';

// ClaudeExecutor 和 CursorExecutor 使用此适配器在 Docker 容器中执行命令
/**
 * 容器执行适配器
 * 将容器操作适配到 IExecutionEngine 接口
 */
export class ExecutionAdapter {
  /**
   * 构造函数
   * @param {Object} config - 配置
   * @param {number} config.userId - 用户 ID
   */
  constructor(config = {}) {
    this.userId = config.userId;
    this.containerManager = config.containerManager || containerManager;
    this.activeSessions = new Map();
  }

  // 由 IExecutionEngine 实现调用以在用户容器中运行 shell 命令
  /**
   * 在容器中执行命令
   * @param {string} command - 命令
   * @param {Object} options - 选项
   * @param {string} options.cwd - 工作目录
   * @param {Object} options.writer - WebSocket 写入器
   * @param {Object} options.env - 环境变量
   * @returns {Promise<Object>} 执行结果
   */
  async execute(command, options = {}) {
    const { cwd, writer, env = {} } = options;

    try {
      // 确保容器存在
      const container = await this.containerManager.getOrCreateContainer(this.userId);
      if (!container) {
        throw new Error(`Failed to get or create container for user ${this.userId}`);
      }

      // 构建执行命令
      const execOptions = {
        Cmd: ['/bin/sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        Env: this._buildEnvVariables(env),
        WorkingDir: cwd || CONTAINER.paths.workspace
      };

      // 执行命令
      const exec = await this.containerManager.docker.exec.create(container.id, execOptions);
      const stream = await this.containerManager.docker.exec.start(exec.id);

      return {
        execId: exec.id,
        containerId: container.id,
        stream,
        command,
        cwd: execOptions.WorkingDir
      };

    } catch (error) {
      throw this._standardizeError(error, 'execute');
    }
  }

  // 当用户点击停止按钮时由 WebSocket 中止处理程序调用
  /**
   * 中止执行
   * @param {string} sessionId - 会话 ID（exec ID）
   * @returns {Promise<boolean>}
   */
  async abort(sessionId) {
    try {
      // 停止 exec 实例
      await this.containerManager.docker.exec.inspect(sessionId).then(async () => {
        await this.containerManager.docker.exec.stop(sessionId);
      }).catch(() => {
        // exec 可能已经停止，忽略错误
      });

      this.activeSessions.delete(sessionId);
      return true;

    } catch (error) {
      throw this._standardizeError(error, 'abort');
    }
  }

  // 由会话管理调用以检查 exec 会话是否仍在运行
  /**
   * 检查会话是否活动
   * @param {string} sessionId - 会话 ID
   * @returns {boolean}
   */
  isSessionActive(sessionId) {
    return this.activeSessions.has(sessionId);
  }

  // 由管理 API 调用以列出所有活动的容器会话
  /**
   * 获取活动会话列表
   * @returns {Array<string>}
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }

  // 由终端 API 调用以在容器中创建交互式 shell 会话
  /**
   * 在容器中创建 PTY 会话
   * @param {Object} options - 选项
   * @param {string}.options.cwd - 工作目录
   * @param {Object} options.writer - WebSocket 写入器
   * @returns {Promise<Object>} PTY 会话信息
   */
  async createPty(options = {}) {
    const { cwd, writer } = options;

    try {
      // 动态导入 PTY 模块以避免循环依赖
      const { createPtyInContainer } = await import('../PtyContainer.js');
      const ptyInfo = await createPtyInContainer(this.userId, {
        cwd: cwd || CONTAINER.paths.workspace,
        writer
      });

      // 跟踪活动会话
      if (ptyInfo.sessionId) {
        this.activeSessions.set(ptyInfo.sessionId, {
          type: 'pty',
          createdAt: Date.now()
        });
      }

      return ptyInfo;

    } catch (error) {
      throw this._standardizeError(error, 'createPty');
    }
  }

  // 由 execute() 使用以准备 Docker exec 的环境变量
  /**
   * 构建环境变量数组
   * @private
   * @param {Object} env - 环境变量对象
   * @returns {Array<string>} 环境变量数组
   */
  _buildEnvVariables(env) {
    const envArray = [];

    // 添加基础环境变量
    if (process.env.PATH) {
      envArray.push(`PATH=${process.env.PATH}`);
    }
    if (process.env.HOME) {
      envArray.push(`HOME=${process.env.HOME}`);
    }

    // 添加自定义环境变量
    for (const [key, value] of Object.entries(env)) {
      envArray.push(`${key}=${value}`);
    }

    return envArray;
  }

  // 为 API 响应包装所有 Docker 错误并提供一致的错误元数据
  /**
   * 标准化错误
   * @private
   * @param {Error} error - 原始错误
   * @param {string} operation - 操作名称
   * @returns {Error} 标准化的错误
   */
  _standardizeError(error, operation) {
    const standardizedError = new Error(
      error.message || `${operation} failed in container`
    );

    standardizedError.type = 'container_execution_error';
    standardizedError.operation = operation;
    standardizedError.userId = this.userId;
    standardizedError.timestamp = new Date().toISOString();
    standardizedError.originalError = error;

    return standardizedError;
  }

  // 在服务器关闭或用户登出时调用
  /**
   * 清理资源
   */
  cleanup() {
    this.activeSessions.clear();
  }
}

export default ExecutionAdapter;
