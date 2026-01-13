/**
 * execution/claude/index.js
 *
 * Claude 执行模块统一导出
 */

export { ClaudeExecutor } from './ClaudeExecutor.js';
export { mapCliOptionsToSDK, validateSdkOptions } from './OptionsMapper.js';
export { handleImages, cleanupTempFiles } from './ImageHandler.js';
export { loadMcpConfig } from './McpConfigLoader.js';

// 延迟初始化执行器实例
let executorInstance = null;

function getExecutorInstance() {
  if (!executorInstance) {
    const { ClaudeExecutor } = require('./ClaudeExecutor.js');
    executorInstance = new ClaudeExecutor();
  }
  return executorInstance;
}

/**
 * 查询 Claude SDK（函数接口）
 * @param {string} command - 用户命令
 * @param {Object} options - 执行选项
 * @param {Object} writer - WebSocket 写入器
 * @returns {Promise<void>}
 */
export async function queryClaudeSDK(command, options = {}, writer) {
  return getExecutorInstance().execute(command, options, writer);
}

/**
 * 中止 Claude SDK 会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>}
 */
export async function abortClaudeSDKSession(sessionId) {
  return getExecutorInstance().abort(sessionId);
}

/**
 * 检查 Claude SDK 会话是否活动
 * @param {string} sessionId - 会话 ID
 * @returns {boolean}
 */
export function isClaudeSDKSessionActive(sessionId) {
  return getExecutorInstance().isSessionActive(sessionId);
}

/**
 * 获取所有活动的 Claude SDK 会话
 * @returns {Array<string>}
 */
export function getActiveClaudeSDKSessions() {
  return getExecutorInstance().getActiveSessions();
}
