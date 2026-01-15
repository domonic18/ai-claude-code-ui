/**
 * McpClient.js
 *
 * MCP客户端实现，用于连接和与MCP服务器通信
 *
 * @module services/mcp/McpClient
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

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
    try {
      if (this.server.type === 'stdio') {
        return await this._connectStdio();
      } else if (this.server.type === 'http') {
        return await this._connectHttp();
      } else if (this.server.type === 'sse') {
        return await this._connectSse();
      } else {
        throw new Error(`Unsupported MCP server type: ${this.server.type}`);
      }
    } catch (error) {
      console.error(`[McpClient] Failed to connect to ${this.server.name}:`, error);
      return false;
    }
  }

  /**
   * 连接到stdio类型的MCP服务器
   * @private
   * @returns {Promise<boolean>} 连接是否成功
   */
  async _connectStdio() {
    return new Promise((resolve, reject) => {
      try {
        const { command, args = [], env = {} } = this.server.config;

        if (!command) {
          reject(new Error('Stdio server requires command'));
          return;
        }

        console.log(`[McpClient] Starting stdio server: ${command} ${args.join(' ')}`);

        // 准备环境变量
        const envOptions = {
          ...process.env,
          ...env
        };

        // 启动进程
        this.process = spawn(command, args, {
          env: envOptions,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        // 监听stdout
        this.process.stdout.on('data', (data) => {
          stdout += data.toString();
          this._handleMessage(data.toString());
        });

        // 监听stderr
        this.process.stderr.on('data', (data) => {
          stderr += data.toString();
          console.error(`[McpClient] stderr: ${data}`);
        });

        // 监听进程退出
        this.process.on('close', (code) => {
          console.log(`[McpClient] Process exited with code ${code}`);
          this.connected = false;
          this.emit('disconnected');
        });

        // 监听错误
        this.process.on('error', (error) => {
          console.error(`[McpClient] Process error:`, error);
          this.connected = false;
          reject(error);
        });

        // 等待一小段时间确认进程启动成功
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.connected = true;
            console.log(`[McpClient] Connected to ${this.server.name}`);
            this.emit('connected');
            resolve(true);
          } else {
            reject(new Error('Process failed to start'));
          }
        }, 500);

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
    // HTTP连接需要实现HTTP客户端
    // 这里先返回基础实现
    console.log(`[McpClient] HTTP connection not fully implemented for ${this.server.name}`);
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
    // SSE连接需要实现SSE客户端
    // 这里先返回基础实现
    console.log(`[McpClient] SSE connection not fully implemented for ${this.server.name}`);
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
      // 尝试解析JSON-RPC消息
      const messages = data.toString().split('\n').filter(line => line.trim());

      for (const message of messages) {
        try {
          const msg = JSON.parse(message);
          this.emit('message', msg);
        } catch (e) {
          // 不是JSON消息，忽略
          console.debug(`[McpClient] Non-JSON message:`, message);
        }
      }
    } catch (error) {
      console.error(`[McpClient] Error handling message:`, error);
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

    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };

    console.log(`[McpClient] Sending request:`, method);

    // 对于stdio，写入stdin
    if (this.server.type === 'stdio' && this.process) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, 10000);

        // 监听响应
        const messageHandler = (msg) => {
          if (msg.id === request.id) {
            clearTimeout(timeout);
            this.removeListener('message', messageHandler);

            if (msg.error) {
              reject(new Error(msg.error.message));
            } else {
              resolve(msg.result);
            }
          }
        };

        this.on('message', messageHandler);

        // 发送请求
        this.process.stdin.write(JSON.stringify(request) + '\n');
      });
    }

    // HTTP和SSE需要单独实现
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
        return {
          success: false,
          status: 'failed',
          message: `Failed to connect to ${this.server.name}`
        };
      }

      // 尝试发送initialize请求
      try {
        const result = await this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'claude-code-ui',
            version: '1.0.0'
          }
        });

        return {
          success: true,
          status: 'connected',
          message: `${this.server.name} is responding`,
          serverName: this.server.name,
          serverType: this.server.type,
          serverInfo: result
        };
      } catch (error) {
        return {
          success: true,
          status: 'connected',
          message: `${this.server.name} is connected but initialize failed: ${error.message}`,
          serverName: this.server.name,
          serverType: this.server.type
        };
      }

    } catch (error) {
      return {
        success: false,
        status: 'failed',
        message: error.message
      };
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
        return {
          success: false,
          error: 'Failed to connect'
        };
      }

      // 发送initialize请求
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'claude-code-ui',
          version: '1.0.0'
        }
      });

      // 发送initialized通知
      await this.sendRequest('notifications/initialized');

      // 请求工具列表
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
      return {
        success: false,
        error: error.message,
        tools: []
      };
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
