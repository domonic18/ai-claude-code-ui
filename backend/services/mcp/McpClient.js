/**
 * McpClient.js
 *
 * MCP客户端实现，用于连接和与MCP服务器通信
 *
 * @module services/mcp/McpClient
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';
import { spawnStdioProcess, setupStdioProcessListeners } from './helpers/stdioProcessManager.js';
import {
  buildJsonRpcRequest,
  sendStdioRequest,
  buildInitializeParams,
  buildTestResult,
} from './helpers/mcpRequestHandler.js';

const logger = createLogger('services/mcp/McpClient');

/**
 * MCP客户端类
 * 负责与MCP服务器建立连接并执行操作
 */
export class McpClient extends EventEmitter {
  /**
   * 构造函数
   * @param {Object} server - MCP服务器配置
   * @param {string} server.name - 服务器名称
   * @param {string} server.type - 服务器类型 (stdio, http, sse)
   * @param {Object} server.config - 服务器配置
   */
  constructor(server) {
    super();
    this.server = server;
    this.connected = false;
    this.process = null;
    this.requestId = 0;
  }

  /**
   * 连接到MCP服务器
   * @returns {Promise<boolean>} 连接是否成功
   */
  async connect() {
    const connectMethods = {
      stdio: () => this._connectStdio(),
      http: () => this._connectHttp(),
      sse: () => this._connectSse(),
    };

    const method = connectMethods[this.server.type];
    if (!method) {
      throw new Error(`Unsupported MCP server type: ${this.server.type}`);
    }

    try {
      return await method();
    } catch (error) {
      logger.error(`[McpClient] Failed to connect to ${this.server.name}:`, error);
      return false;
    }
  }

  /**
   * 连接到stdio类型的MCP服务器
   * @private
   * @returns {Promise<boolean>} 连接是否成功
   */
  _connectStdio() {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawnStdioProcess(this.server.config);
        setupStdioProcessListeners(this.process, this, resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 连接到HTTP类型的MCP服务器
   * @private
   * @returns {Promise<boolean>} 连接是否成功
   */
  async _connectHttp() {
    logger.info(`[McpClient] HTTP connection not fully implemented for ${this.server.name}`);
    this.connected = true;
    this.emit('connected');
    return true;
  }

  /**
   * 连接到SSE类型的MCP服务器
   * @private
   * @returns {Promise<boolean>} 连接是否成功
   */
  async _connectSse() {
    logger.info(`[McpClient] SSE connection not fully implemented for ${this.server.name}`);
    this.connected = true;
    this.emit('connected');
    return true;
  }

  /**
   * 处理从服务器接收的消息
   * @private
   * @param {string} data - 接收的数据
   */
  _handleMessage(data) {
    try {
      const messages = data.toString().split('\n').filter(line => line.trim());

      for (const message of messages) {
        try {
          const msg = JSON.parse(message);
          this.emit('message', msg);
        } catch {
          logger.debug({ message }, 'Non-JSON message received');
        }
      }
    } catch (error) {
      logger.error(`[McpClient] Error handling message:`, error);
    }
  }

  /**
   * 发送JSON-RPC请求
   * @param {string} method - 方法名
   * @param {Object} params - 参数
   * @returns {Promise<Object>} 响应结果
   */
  async sendRequest(method, params = {}) {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const request = buildJsonRpcRequest(method, params, ++this.requestId);
    logger.info(`[McpClient] Sending request:`, method);

    if (this.server.type === 'stdio' && this.process) {
      return sendStdioRequest(this.process, this, request);
    }

    throw new Error('Request not implemented for this transport type');
  }

  /**
   * 测试连接
   * @returns {Promise<Object>} 测试结果
   */
  async test() {
    try {
      const connected = await this.connect();

      if (!connected) {
        return buildTestResult(false, 'failed', `Failed to connect to ${this.server.name}`, this.server);
      }

      try {
        const result = await this.sendRequest('initialize', buildInitializeParams());
        return buildTestResult(true, 'connected', `${this.server.name} is responding`, this.server, { serverInfo: result });
      } catch (error) {
        return buildTestResult(true, 'connected', `${this.server.name} is connected but initialize failed: ${error.message}`, this.server);
      }
    } catch (error) {
      return { success: false, status: 'failed', message: error.message };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 发现工具
   * @returns {Promise<Object>} 工具列表
   */
  async discoverTools() {
    try {
      const connected = await this.connect();

      if (!connected) {
        return { success: false, error: 'Failed to connect' };
      }

      await this.sendRequest('initialize', buildInitializeParams());
      await this.sendRequest('notifications/initialized');
      const result = await this.sendRequest('tools/list');

      return {
        success: true,
        serverName: this.server.name,
        serverType: this.server.type,
        tools: result.tools || [],
        resources: [],
        prompts: []
      };
    } catch (error) {
      return { success: false, error: error.message, tools: [] };
    } finally {
      this.disconnect();
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.emit('disconnected');
  }
}

export default McpClient;
