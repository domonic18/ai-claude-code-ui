/**
 * ClaudeExecutor.js
 *
 * Claude 执行器
 * 统一的 Claude 执行接口，整合选项映射、图像处理、MCP 配置等功能
 *
 * @module execution/claude/ClaudeExecutor
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { mapCliOptionsToSDK } from './OptionsMapper.js';
import { handleImages, cleanupTempFiles } from './ImageHandler.js';
import { loadMcpConfig } from './McpConfigLoader.js';
import { createLogger } from '../../../utils/logger.js';
import {
  addSession,
  removeSession,
  getSession,
  isSessionActive,
  getActiveSessions
} from './claudeExecutorSession.js';
import {
  processStreamMessages,
  handleNewSession,
  sendCompleteEvent,
  handleExecutionError
} from './claudeExecutorStream.js';

const logger = createLogger('services/execution/claude/ClaudeExecutor');

/**
 * Claude 执行器类
 * 提供统一的 Claude 执行接口
 */
export class ClaudeExecutor {
  /**
   * 构造函数
   * @param {Object} config - 配置选项
   */
  constructor(config = {}) {
    this.activeSessions = new Map();
    this.config = config;
  }

  /**
   * 执行 Claude 查询
   * @param {string} command - 用户命令
   * @param {Object} options - 执行选项
   * @param {Object} writer - WebSocket 写入器
   * @returns {Promise<{sessionId: string}>}
   */
  async execute(command, options = {}, writer) {
    const { sessionId } = options;
    let capturedSessionId = sessionId;
    let queryInstance = null;
    let tempImagePaths = [];
    let tempDir = null;

    try {
      const sdkOptions = await this._prepareSdkOptions(options, command);
      tempImagePaths = sdkOptions.tempImagePaths;
      tempDir = sdkOptions.tempDir;
      const finalCommand = sdkOptions.finalCommand;

      queryInstance = query({
        prompt: finalCommand,
        options: sdkOptions
      });

      if (capturedSessionId) {
        addSession(this.activeSessions, capturedSessionId, queryInstance, tempImagePaths, tempDir);
      }

      capturedSessionId = await processStreamMessages(
        queryInstance,
        capturedSessionId,
        sessionId,
        writer,
        (sid, inst, paths, dir) => addSession(this.activeSessions, sid, inst, paths, dir),
        handleNewSession
      );

      if (capturedSessionId) {
        removeSession(this.activeSessions, capturedSessionId);
      }
      await cleanupTempFiles(tempImagePaths, tempDir);

      sendCompleteEvent(writer, capturedSessionId, sessionId, command);

      return { sessionId: capturedSessionId };

    } catch (error) {
      await handleExecutionError(
        error,
        capturedSessionId,
        tempImagePaths,
        tempDir,
        (sid) => removeSession(this.activeSessions, sid),
        cleanupTempFiles,
        writer
      );
      throw error;
    }
  }

  /**
   * 准备 SDK 选项和命令
   * @private
   */
  async _prepareSdkOptions(options, command) {
    const sdkOptions = mapCliOptionsToSDK(options);

    // 加载 MCP 配置
    const mcpServers = await loadMcpConfig(options.cwd);
    if (mcpServers) {
      sdkOptions.mcpServers = mcpServers;
    }

    // 处理图像 - 保存到临时文件并修改提示
    const imageResult = await handleImages(command, options.images, options.cwd);
    sdkOptions.finalCommand = imageResult.modifiedCommand;
    sdkOptions.tempImagePaths = imageResult.tempImagePaths;
    sdkOptions.tempDir = imageResult.tempDir;

    return sdkOptions;
  }

  /**
   * 中止活动的会话
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>}
   */
  async abort(sessionId) {
    const session = getSession(this.activeSessions, sessionId);

    if (!session) {
      logger.info({ sessionId }, '[ClaudeExecutor] Session not found');
      return false;
    }

    try {
      logger.info({ sessionId }, '[ClaudeExecutor] Aborting session');

      await session.instance.interrupt();

      session.status = 'aborted';

      await cleanupTempFiles(session.tempImagePaths, session.tempDir);

      removeSession(this.activeSessions, sessionId);

      return true;
    } catch (error) {
      logger.error({ sessionId, err: error }, '[ClaudeExecutor] Error aborting session');
      return false;
    }
  }

  /**
   * 检查会话是否活动
   * @param {string} sessionId - 会话 ID
   * @returns {boolean}
   */
  isSessionActive(sessionId) {
    return isSessionActive(this.activeSessions, sessionId);
  }

  /**
   * 获取所有活动会话
   * @returns {Array<string>}
   */
  getActiveSessions() {
    return getActiveSessions(this.activeSessions);
  }
}

export default ClaudeExecutor;
