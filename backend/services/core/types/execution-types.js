/**
 * execution-types.js
 *
 * 执行相关类型定义
 *
 * @module core/types/execution-types
 */

/**
 * 执行结果
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - 是否成功
 * @property {string} output - 标准输出内容
 * @property {string} [error] - 错误输出内容（如果有）
 * @property {number} exitCode - 进程退出码
 * @property {number} duration - 执行时长（毫秒）
 * @property {Date} timestamp - 执行时间戳
 * @property {string} [sessionId] - 关联的会话 ID
 */

/**
 * 执行选项
 * @typedef {Object} ExecutionOptions
 * @property {string} projectName - 项目名称
 * @property {string} sessionId - 会话 ID
 * @property {string} model - AI 模型名称
 * @property {string} cwd - 工作目录
 * @property {Object} writer - WebSocket 写入器
 * @property {number} [timeout] - 超时时间（毫秒），默认 120000
 * @property {Object} [env] - 环境变量
 * @property {string} [provider='claude'] - AI 提供商
 * @property {boolean} [streamOutput=true] - 是否流式输出
 * @property {Object} [context] - 额外的上下文信息
 */

/**
 * 执行引擎类型
 * @typedef {'native'|'container'} ExecutionEngineType
 */

/**
 * AI 提供商类型
 * @typedef {'claude'|'cursor'|'codex'} AIProvider
 */

/**
 * 执行状态
 * @typedef {Object} ExecutionStatus
 * @property {string} sessionId - 会话 ID
 * @property {boolean} isActive - 是否正在执行
 * @property {Date} startTime - 开始时间
 * @property {number} duration - 已执行时长（毫秒）
 * @property {string} command - 当前执行的命令
 */

/**
 * 执行错误类型
 * @typedef {Object} ExecutionError
 * @property {string} code - 错误代码
 * @property {string} message - 错误消息
 * @property {Error} [originalError] - 原始错误对象
 * @property {string} [sessionId] - 关联的会话 ID
 * @property {string} [command] - 导致错误的命令
 */

/**
 * 中止结果
 * @typedef {Object} AbortResult
 * @property {boolean} success - 是否成功中止
 * @property {string} [message] - 结果消息
 * @property {number} [exitCode] - 退出码
 */

/**
 * 流式输出选项
 * @typedef {Object} StreamOptions
 * @property {Function} [onData] - 数据回调
 * @property {Function} [onError] - 错误回调
 * @property {Function} [onComplete] - 完成回调
 * @property {boolean} [includeStderr=true] - 是否包含错误输出
 */

/**
 * 执行环境配置
 * @typedef {Object} ExecutionEnvironment
 * @property {string} type - 环境类型 'native' | 'container'
 * @property {string} [userId] - 用户 ID（容器模式）
 * @property {string} [containerId] - 容器 ID（容器模式）
 * @property {string} [workspacePath] - 工作空间路径
 * @property {Object} [env] - 环境变量
 */

/**
 * 导出常量
 */
export const EXECUTION_CONSTANTS = {
  /** 默认超时时间（毫秒） */
  DEFAULT_TIMEOUT: 120000,
  /** 最大超时时间（毫秒） */
  MAX_TIMEOUT: 600000,
  /** 默认心跳间隔（毫秒） */
  DEFAULT_HEARTBEAT_INTERVAL: 30000,
  /** 最大活动会话数 */
  MAX_ACTIVE_SESSIONS: 100,
  /** 会话清理间隔（毫秒） */
  SESSION_CLEANUP_INTERVAL: 300000,
};

/**
 * 执行错误代码枚举
 */
export const ExecutionErrorCode = {
  TIMEOUT: 'EXEC_TIMEOUT',
  ABORTED: 'EXEC_ABORTED',
  NOT_FOUND: 'EXEC_NOT_FOUND',
  PERMISSION_DENIED: 'EXEC_PERMISSION_DENIED',
  INVALID_COMMAND: 'EXEC_INVALID_COMMAND',
  CONTAINER_ERROR: 'EXEC_CONTAINER_ERROR',
  STREAM_ERROR: 'EXEC_STREAM_ERROR',
  UNKNOWN: 'EXEC_UNKNOWN',
};

/**
 * 执行状态枚举
 */
export const ExecutionState = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABORTED: 'aborted',
  TIMEOUT: 'timeout',
};

/**
 * 创建执行错误
 * @param {string} code - 错误代码
 * @param {string} message - 错误消息
 * @param {Error} [originalError] - 原始错误
 * @returns {ExecutionError}
 */
export function createExecutionError(code, message, originalError = null) {
  const error = new Error(message);
  error.code = code;
  error.originalError = originalError;
  return error;
}

/**
 * 检查是否为执行错误
 * @param {Error} error - 错误对象
 * @param {string} [code] - 可选的错误代码
 * @returns {boolean}
 */
export function isExecutionError(error, code) {
  if (!error || typeof error !== 'object') return false;
  if (code) return error.code === code;
  return error.code && error.code.startsWith('EXEC_');
}

export default {
  EXECUTION_CONSTANTS,
  ExecutionErrorCode,
  ExecutionState,
  createExecutionError,
  isExecutionError,
};
