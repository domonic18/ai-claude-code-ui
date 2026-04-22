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
        this.ws = new WebSocket(this.url);

        // 连接成功后的处理
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
          }
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

    this.reconnectAttempts++;
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Close WebSocket connection
   * 关闭 WebSocket 连接并停止重连
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

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
