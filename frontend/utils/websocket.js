import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(isEnabled = true) {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const wsRef = useRef(null);
  const isEnabledRef = useRef(isEnabled);
  const isConnectingRef = useRef(false);

  // 更新 ref
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  const connect = useCallback(async () => {
    // 防止重复连接
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // 如果未启用，不连接
    if (!isEnabledRef.current) {
      return;
    }

    isConnectingRef.current = true;

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
            // 后端返回 {success: true, data: {token}}
            token = data.data?.token;
          } else {
            console.warn('[WebSocket] Failed to get ws-token:', response.status, response.statusText);
            isConnectingRef.current = false;
            return;
          }
        } catch (error) {
          console.error('[WebSocket] Error fetching ws-token:', error);
          isConnectingRef.current = false;
          return;
        }

        if (!token) {
          console.warn('[WebSocket] No token received from server');
          isConnectingRef.current = false;
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
        isConnectingRef.current = false;
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
        isConnectingRef.current = false;

        // 如果不是正常关闭且仍然启用，尝试重连
        if (event.code !== 1000 && isEnabledRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };

      websocket.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        isConnectingRef.current = false;
      };

    } catch (error) {
      console.error('[WebSocket] Error creating connection:', error);
      isConnectingRef.current = false;
    }
  }, []); // 空依赖数组，connect 函数只创建一次

  // 当 isEnabled 变化时重新连接
  useEffect(() => {
    // 初始连接
    if (isEnabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isEnabled, connect]);

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
