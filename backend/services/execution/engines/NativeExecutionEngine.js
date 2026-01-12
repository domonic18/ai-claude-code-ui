/**
 * NativeExecutionEngine.js
 *
 * 原生执行引擎
 * 在主机上直接调用 Claude SDK，无需容器
 *
 * @module execution/engines/NativeExecutionEngine
 */

import { BaseExecutionEngine } from './BaseExecutionEngine.js';
import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * 原生执行引擎
 * 直接在主机上执行 Claude SDK 调用
 */
export class NativeExecutionEngine extends BaseExecutionEngine {
  /**
   * 构造函数
   * @param {Object} config - 引擎配置
   */
  constructor(config = {}) {
    super({
      name: 'NativeExecutionEngine',
      version: '1.0.0',
      ...config
    });
    this.engineType = 'native';
  }

  /**
   * 执行 Claude 命令（原生模式）
   * @param {string} command - 用户命令
   * @param {Object} options - 执行选项
   * @param {Object} writer - WebSocket 写入器
   * @returns {Promise<{sessionId: string}>}
   */
  async execute(command, options = {}, writer) {
    const { sessionId, userId, ...sdkOptions } = options;
    let capturedSessionId = sessionId;
    let queryInstance = null;

    try {
      // 验证选项
      const validation = this._validateOptions(options);
      if (!validation.valid) {
        throw new Error(`Invalid options: ${validation.errors.join(', ')}`);
      }

      // 创建 SDK 查询
      queryInstance = query({
        prompt: command,
        options: sdkOptions
      });

      // 跟踪会话
      if (capturedSessionId) {
        this._addSession(capturedSessionId, {
          instance: queryInstance,
          userId,
          command
        });
      }

      // 处理流式消息
      for await (const message of queryInstance) {
        // 捕获会话 ID
        if (message.session_id && !capturedSessionId) {
          capturedSessionId = message.session_id;
          this._addSession(capturedSessionId, {
            instance: queryInstance,
            userId,
            command
          });

          // 通知前端会话已创建
          if (writer && !sessionId) {
            writer.send({
              type: 'session-created',
              sessionId: capturedSessionId
            });
          }
        }

        // 发送消息到前端
        if (writer) {
          writer.send({
            type: 'claude-response',
            data: message
          });
        }

        // 处理完成
        if (message.type === 'result') {
          const tokenBudget = this._extractTokenBudget(message);
          if (tokenBudget && writer) {
            writer.send({
              type: 'token-budget',
              data: tokenBudget
            });
          }
        }
      }

      // 完成时清理
      if (capturedSessionId) {
        this._removeSession(capturedSessionId);
      }

      // 发送完成事件
      if (writer) {
        writer.send({
          type: 'claude-complete',
          sessionId: capturedSessionId,
          exitCode: 0,
          isNewSession: !sessionId && !!command
        });
      }

      return { sessionId: capturedSessionId };

    } catch (error) {
      // 错误时清理
      if (capturedSessionId) {
        this._removeSession(capturedSessionId);
      }

      // 发送错误
      if (writer) {
        writer.send({
          type: 'claude-error',
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

    if (!session || !session.instance) {
      return false;
    }

    try {
      await session.instance.interrupt();
      this._updateSession(sessionId, { status: 'aborted' });
      this._removeSession(sessionId);
      return true;
    } catch (error) {
      console.error(`Error aborting session ${sessionId}:`, error);
      return false;
    }
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

    return {
      used: totalUsed,
      total: contextWindow
    };
  }
}

export default NativeExecutionEngine;
