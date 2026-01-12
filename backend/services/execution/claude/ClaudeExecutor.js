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
      // 将 CLI 选项映射为 SDK 格式
      const sdkOptions = mapCliOptionsToSDK(options);

      // 加载 MCP 配置
      const mcpServers = await loadMcpConfig(options.cwd);
      if (mcpServers) {
        sdkOptions.mcpServers = mcpServers;
      }

      // 处理图像 - 保存到临时文件并修改提示
      const imageResult = await handleImages(command, options.images, options.cwd);
      const finalCommand = imageResult.modifiedCommand;
      tempImagePaths = imageResult.tempImagePaths;
      tempDir = imageResult.tempDir;

      // 创建 SDK 查询实例
      queryInstance = query({
        prompt: finalCommand,
        options: sdkOptions
      });

      // 跟踪查询实例以支持中止功能
      if (capturedSessionId) {
        this._addSession(capturedSessionId, queryInstance, tempImagePaths, tempDir);
      }

      // 处理流式消息
      console.log('Starting async generator loop for session:', capturedSessionId || 'NEW');
      for await (const message of queryInstance) {
        // 从第一条消息捕获会话 ID
        if (message.session_id && !capturedSessionId) {
          capturedSessionId = message.session_id;
          this._addSession(capturedSessionId, queryInstance, tempImagePaths, tempDir);

          // 在 writer 上设置会话 ID
          if (writer && writer.setSessionId && typeof writer.setSessionId === 'function') {
            writer.setSessionId(capturedSessionId);
          }

          // 仅为新会话发送一次 session-created 事件
          if (!sessionId) {
            writer.send({
              type: 'session-created',
              sessionId: capturedSessionId
            });
          }
        }

        // 转换并发送消息到 WebSocket
        writer.send({
          type: 'claude-response',
          data: message
        });

        // 从结果消息中提取并发送 token 预算更新
        if (message.type === 'result') {
          const tokenBudget = this._extractTokenBudget(message);
          if (tokenBudget) {
            console.log('Token budget from modelUsage:', tokenBudget);
            writer.send({
              type: 'token-budget',
              data: tokenBudget
            });
          }
        }
      }

      // 完成时清理会话
      if (capturedSessionId) {
        this._removeSession(capturedSessionId);
      }

      // 清理临时图像文件
      await cleanupTempFiles(tempImagePaths, tempDir);

      // 发送完成事件
      console.log('Streaming complete, sending claude-complete event');
      writer.send({
        type: 'claude-complete',
        sessionId: capturedSessionId,
        exitCode: 0,
        isNewSession: !sessionId && !!command
      });
      console.log('claude-complete event sent');

      return { sessionId: capturedSessionId };

    } catch (error) {
      console.error('Claude executor error:', error);

      // 错误时清理会话
      if (capturedSessionId) {
        this._removeSession(capturedSessionId);
      }

      // 错误时清理临时图像文件
      await cleanupTempFiles(tempImagePaths, tempDir);

      // 发送错误到 WebSocket
      writer.send({
        type: 'claude-error',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * 中止活动的会话
   * @param {string} sessionId - 会话 ID
   * @returns {Promise<boolean>}
   */
  async abort(sessionId) {
    const session = this._getSession(sessionId);

    if (!session) {
      console.log(`Session ${sessionId} not found`);
      return false;
    }

    try {
      console.log(`Aborting Claude session: ${sessionId}`);

      // 在查询实例上调用 interrupt()
      await session.instance.interrupt();

      // 更新会话状态
      session.status = 'aborted';

      // 清理临时图像文件
      await cleanupTempFiles(session.tempImagePaths, session.tempDir);

      // 清理会话
      this._removeSession(sessionId);

      return true;
    } catch (error) {
      console.error(`Error aborting session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 检查会话是否活动
   * @param {string} sessionId - 会话 ID
   * @returns {boolean}
   */
  isSessionActive(sessionId) {
    const session = this._getSession(sessionId);
    return session && session.status === 'active';
  }

  /**
   * 获取所有活动会话
   * @returns {Array<string>}
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * 添加会话到活动会话映射
   * @private
   * @param {string} sessionId - 会话 ID
   * @param {Object} queryInstance - SDK 查询实例
   * @param {Array<string>} tempImagePaths - 临时图像路径
   * @param {string} tempDir - 临时目录
   */
  _addSession(sessionId, queryInstance, tempImagePaths = [], tempDir = null) {
    this.activeSessions.set(sessionId, {
      instance: queryInstance,
      startTime: Date.now(),
      status: 'active',
      tempImagePaths,
      tempDir
    });
  }

  /**
   * 从活动会话映射中移除会话
   * @private
   * @param {string} sessionId - 会话 ID
   */
  _removeSession(sessionId) {
    this.activeSessions.delete(sessionId);
  }

  /**
   * 获取会话
   * @private
   * @param {string} sessionId - 会话 ID
   * @returns {Object|undefined}
   */
  _getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 提取 Token 使用情况
   * @private
   * @param {Object} resultMessage - SDK 结果消息
   * @returns {Object|null}
   */
  _extractTokenBudget(resultMessage) {
    if (resultMessage.type !== 'result' || !resultMessage.modelUsage) {
      return null;
    }

    const modelKey = Object.keys(resultMessage.modelUsage)[0];
    const modelData = resultMessage.modelUsage[modelKey];

    if (!modelData) {
      return null;
    }

    const inputTokens = modelData.cumulativeInputTokens || modelData.inputTokens || 0;
    const outputTokens = modelData.cumulativeOutputTokens || modelData.outputTokens || 0;
    const cacheReadTokens = modelData.cumulativeCacheReadInputTokens || modelData.cacheReadInputTokens || 0;
    const cacheCreationTokens = modelData.cumulativeCacheCreationInputTokens || modelData.cacheCreationInputTokens || 0;

    const totalUsed = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
    const contextWindow = parseInt(process.env.CONTEXT_WINDOW) || 200000;

    console.log(`Token calculation: input=${inputTokens}, output=${outputTokens}, cache=${cacheReadTokens + cacheCreationTokens}, total=${totalUsed}/${contextWindow}`);

    return {
      used: totalUsed,
      total: contextWindow
    };
  }
}

export default ClaudeExecutor;
