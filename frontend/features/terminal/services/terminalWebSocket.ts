/**
 * WebSocket Terminal Connection Manager
 *
 * Extracted WebSocket management logic from terminalService.
 */

/**
 * WebSocket terminal connection manager
 */
export class TerminalWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 3000;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket
   */
  connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          resolve(this.ws!);
        };

        this.ws.onerror = (error) => {
          reject(error);
        };

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
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnect will be scheduled again by onclose
      });
    }, this.reconnectInterval);
  }

  /**
   * Send message through WebSocket
   */
  send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Close WebSocket connection
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
   */
  get socket(): WebSocket | null {
    return this.ws;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Set message handlers
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
   */
  onError(callback: (error: Event) => void): void {
    if (this.ws) {
      this.ws.onerror = callback;
    }
  }

  /**
   * Set close handler
   */
  onClose(callback: () => void): void {
    if (this.ws) {
      this.ws.onclose = callback;
    }
  }
}

/**
 * Create a WebSocket terminal connection
 */
export function createTerminalWebSocket(url: string): TerminalWebSocket {
  return new TerminalWebSocket(url);
}
