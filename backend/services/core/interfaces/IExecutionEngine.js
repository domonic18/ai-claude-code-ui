/**
 * IExecutionEngine.js
 *
 * 执行引擎接口 - 统一容器和非容器执行模式
 *
 * @module core/interfaces/IExecutionEngine
 */

/**
 * 执行引擎接口
 * 定义了 AI 命令执行的核心操作，支持容器和非容器模式
 */
export class IExecutionEngine {
  /**
   * 执行命令
   * @param {string} command - 要执行的命令
   * @param {Object} options - 执行选项
   * @param {string} options.projectName - 项目名称
   * @param {string} options.sessionId - 会话 ID
   * @param {string} options.model - AI 模型
   * @param {string} options.cwd - 工作目录
   * @param {Object} options.writer - WebSocket 写入器
   * @returns {Promise<Object>} 执行结果
   */
  async execute(command, options, writer) {
    throw new Error('IExecutionEngine.execute() must be implemented');
  }

  /**
   * 中止执行
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>} 是否成功中止
   */
  async abort(sessionId) {
    throw new Error('IExecutionEngine.abort() must be implemented');
  }

  /**
   * 检查会话是否活动
   * @param {string} sessionId - 会话 ID
   * @returns {boolean} 是否活动
   */
  isSessionActive(sessionId) {
    throw new Error('IExecutionEngine.isSessionActive() must be implemented');
  }

  /**
   * 获取活动会话列表
   * @returns {Array<string>} 活动会话 ID 列表
   */
  getActiveSessions() {
    throw new Error('IExecutionEngine.getActiveSessions() must be implemented');
  }

  /**
   * 获取执行引擎类型
   * @returns {string} 'native' | 'container'
   */
  getType() {
    throw new Error('IExecutionEngine.getType() must be implemented');
  }
}

/**
 * 执行结果类型定义
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - 是否成功
 * @property {string} output - 输出内容
 * @property {string} [error] - 错误信息（如果有）
 * @property {number} exitCode - 退出码
 */

/**
 * 执行选项类型定义
 * @typedef {Object} ExecutionOptions
 * @property {string} projectName - 项目名称
 * @property {string} sessionId - 会话 ID
 * @property {string} model - AI 模型名称
 * @property {string} cwd - 工作目录
 * @property {Object} writer - WebSocket 写入器
 * @property {number} [timeout] - 超时时间（毫秒）
 * @property {Object} [env] - 环境变量
 */

export default IExecutionEngine;
