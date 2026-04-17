/**
 * Container Shell Session
 *
 * Manages a container shell session with WebSocket connection
 * @module websocket/handlers/ContainerShellSession
 */

import { WebSocket } from 'ws';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('websocket/handlers/ContainerShellSession');

/**
 * Container Shell Session 类
 * 管理容器 shell 会话的生命周期和交互
 */
export class ContainerShellSession {
  /**
   * 创建容器 shell 会话
   * @param {Object} attachResult - 容器附加结果
   * @param {Object} stream - 容器流
   * @param {WebSocket} ws - WebSocket 连接
   * @param {string} projectPath - 项目路径
   * @param {string} sessionId - 会话 ID
   * @param {number} userId - 用户 ID
   */
  constructor(attachResult, stream, ws, projectPath, sessionId, userId) {
    this.attachResult = attachResult;
    this.stream = stream;
    this.ws = ws;
    this.buffer = [];
    this.projectPath = projectPath;
    this.sessionId = sessionId;
    this.userId = userId;
    this.timeoutId = null;
  }

  /**
   * 调整终端大小
   * @param {number} cols - 列数
   * @param {number} rows - 行数
   * @returns {Promise<void>}
   */
  async resize(cols, rows) {
    try {
      // container.attach() 不支持动态调整 TTY 大小
      // TTY 大小在 attach 时确定，后续无法更改
      logger.debug('[Container Shell] Resize requested (not supported with attach):', cols, 'x', rows);
    } catch (err) {
      logger.error('[Container Shell] Resize error:', err);
    }
  }

  /**
   * 向会话写入数据
   * @param {string} inputData - 输入数据
   * @returns {Promise<void>}
   */
  async write(inputData) {
    try {
      // 向 attached shell 流写入数据
      // stream 现在应该是可写的 Duplex 流
      if (this.stream && this.stream.writable) {
        this.stream.write(inputData);
      }
    } catch (err) {
      logger.error('[Container Shell] Write error:', err);
    }
  }

  /**
   * 终止会话
   * @returns {Promise<void>}
   */
  async kill() {
    try {
      // 关闭 attached 流
      if (this.stream && !this.stream.destroyed) {
        this.stream.destroy();
      }
    } catch (err) {
      logger.error('[Container Shell] Kill error:', err);
    }
  }

  /**
   * 设置会话超时
   * @param {string} ptySessionKey - 会话键
   * @param {Map} ptySessionsMap - 会话映射
   * @param {number} timeout - 超时时间（毫秒）
   */
  setTimeout(ptySessionKey, ptySessionsMap, timeout) {
    if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => {
        logger.info('[Container Shell] Session timeout, cleaning up:', ptySessionKey);
        if (this.kill) {
          this.kill();
        }
        ptySessionsMap.delete(ptySessionKey);
      }, timeout);
    }
  }

  /**
   * 启动流数据监听
   * @param {string} ptySessionKey - 会话键
   * @param {Map} ptySessionsMap - 会话映射
   */
  startStreamListeners(ptySessionKey, ptySessionsMap) {
    // 确保流在流动（某些情况下流可能被暂停）
    if (this.stream.isPaused()) {
      this.stream.resume();
    }

    // 直接从原始流读取数据（hijack 模式不使用多路复用）
    this.stream.on('data', (chunk) => {
      this._handleData(chunk);
    });

    // 处理流结束
    this.stream.on('end', () => {
      this._handleEnd(ptySessionKey, ptySessionsMap);
    });

    this.stream.on('error', (err) => {
      this._handleError(err);
    });
  }

  /**
   * 处理流数据
   * @private
   * @param {Buffer} chunk - 数据块
   */
  _handleData(chunk) {
    if (this.buffer.length < 5000) {
      this.buffer.push(chunk.toString());
    } else {
      this.buffer.shift();
      this.buffer.push(chunk.toString());
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'output',
        data: chunk.toString()
      }));
    }
  }

  /**
   * 处理流结束
   * @private
   * @param {string} ptySessionKey - 会话键
   * @param {Map} ptySessionsMap - 会话映射
   */
  _handleEnd(ptySessionKey, ptySessionsMap) {
    logger.info('[Container Shell] Process ended');
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'output',
        data: `\r\n\x1b[33mProcess exited\x1b[0m\r\n`
      }));
    }
    ptySessionsMap.delete(ptySessionKey);
  }

  /**
   * 处理流错误
   * @private
   * @param {Error} err - 错误对象
   */
  _handleError(err) {
    logger.error('[Container Shell] Stream error:', err);
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'output',
        data: `\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`
      }));
    }
  }
}
