import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(isEnabled = true) {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const wsRef = useRef(null);

  const connect = useCallback(async () => {
    // 如果未启用，不连接
    if (!isEnabled) {
      return;
    }

    // 清除之前的连接
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    try {
      const isPlatform = import.meta.env.VITE_IS_PLATFORM === 'true';

      // Construct WebSocket URL
      let wsUrl;

      if (isPlatform) {
        // Platform mode: Use same domain as the page (goes through proxy)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      } else {
        // OSS mode: Connect to same host:port that served the page
        // 先尝试从服务器获取当前 token（用于 WebSocket 认证）
        let token;
        try {
          const response = await fetch('/api/auth/ws-token', {
            credentials: 'include' // 发送 cookie
          });
          if (response.ok) {
            const data = await response.json();
            token = data.token;
          }
        } catch (error) {
          // 静默跳过：用户未登录时不显示错误
          return;
        }

        if (!token) {
          // 静默跳过：用户未登录时不显示警告
          return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      }

      console.log('[WebSocket] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=***'));

      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        setIsConnected(true);
        setWs(websocket);
        wsRef.current = websocket;
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, data]);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      websocket.onclose = (event) => {
        console.log('[WebSocket] Disconnected, code:', event.code, 'reason:', event.reason);
        setIsConnected(false);
        setWs(null);
        wsRef.current = null;

        // 如果不是正常关闭，尝试重连
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };

      websocket.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

    } catch (error) {
      console.error('[WebSocket] Error creating connection:', error);
    }
  }, [isEnabled]); // 依赖 isEnabled，当用户登录状态变化时重新连接

  // 当 isEnabled 变化时重新连接
  useEffect(() => {
    // 初始连接
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = (message) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  };

  return {
    ws,
    sendMessage,
    messages,
    isConnected
  };
}
