/**
 * WebSocket Terminal Connection Manager
 *
 * Extracted WebSocket management logic from terminalService.
 * WebSocket 终端连接管理器，提供自动重连和事件处理
 */

/**
 * WebSocket terminal connection manager
 * WebSocket 终端连接管理器类
 */
export class TerminalWebSocket {
  // WebSocket 实例
  private ws: WebSocket | null = null;
  // WebSocket 服务器 URL
  private url: string;
  // 重连定时器
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  // 当前重连尝试次数
  private reconnectAttempts = 0;
  // 最大重连尝试次数
  private maxReconnectAttempts = 10;
  // 重连间隔（毫秒）
  private reconnectInterval = 3000;

  /**
   * 构造函数：创建 WebSocket 连接管理器
   * @param url - WebSocket 服务器 URL
   */
  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket
   * 建立 WebSocket 连接
   */
  connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        // 创建 WebSocket 实例
        this.ws = new WebSocket(this.url);

        // 连接成功后的处理
        this.ws.onopen = () => {
          // 重置重连计数器
          this.reconnectAttempts = 0;
          // 清除重连定时器
          if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          // 返回 WebSocket 实例
          resolve(this.ws!);
        };

        // 连接错误的处理
        this.ws.onerror = (error) => {
          reject(error);
        };

        // 连接关闭后自动重连
        this.ws.onclose = () => {
          this.scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Schedule reconnection attempt
   * 安排重连尝试
   */
  private scheduleReconnect() {
    // 达到最大重连次数后停止
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    // 增加重连尝试计数
    this.reconnectAttempts++;
    // 设置延迟重连
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnect will be scheduled again by onclose
        // 重连失败会由 onclose 再次触发重连
      });
    }, this.reconnectInterval);
  }

  /**
   * Send message through WebSocket
   * 通过 WebSocket 发送消息
   */
  send(data: unknown): void {
    // 检查连接状态，仅当连接打开时发送
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 将数据序列化为 JSON 字符串并发送
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Close WebSocket connection
   * 关闭 WebSocket 连接并停止重连
   */
  disconnect(): void {
    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 关闭 WebSocket 连接
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // 设置重连次数为最大值，阻止自动重连
    this.reconnectAttempts = this.maxReconnectAttempts;
  }

  /**
   * Get WebSocket instance
   * 获取 WebSocket 实例
   */
  get socket(): WebSocket | null {
    return this.ws;
  }

  /**
   * Check if connected
   * 检查是否已连接
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Set message handlers
   * 设置消息处理器
   */
  onMessage(callback: (data: unknown) => void): void {
    if (this.ws) {
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callback(data);
        } catch {
          callback(event.data);
        }
      };
    }
  }

  /**
   * Set error handler
   * 设置错误处理器
   */
  onError(callback: (error: Event) => void): void {
    if (this.ws) {
      this.ws.onerror = callback;
    }
  }

  /**
   * Set close handler
   * 设置关闭处理器
   */
  onClose(callback: () => void): void {
    if (this.ws) {
      this.ws.onclose = callback;
    }
  }
}

/**
 * Create a WebSocket terminal connection
 * 创建 WebSocket 终端连接的工厂函数
 */
export function createTerminalWebSocket(url: string): TerminalWebSocket {
  return new TerminalWebSocket(url);
}
