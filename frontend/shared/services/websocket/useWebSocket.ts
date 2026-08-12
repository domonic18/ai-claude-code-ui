import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { WebSocketMessage } from '@/shared/types';
import { logger } from '@/shared/utils/logger';
import { connect, clearConnectionTimers, type WebSocketConnectionRefs } from './useWebSocketConnection';

export interface UseWebSocketResult {
  ws: WebSocket | null;
  sendMessage: (message: any) => void;
  messages: WebSocketMessage[];
  isConnected: boolean;
  /** 断线后正在自动重连中（首次连接前为 false，避免首屏闪横幅） */
  isReconnecting: boolean;
}

/**
 * Create connection callbacks that update state.
 * onConnected 时补发断线期间入队的消息（防丢）。
 */
function createConnectionCallbacks(
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>,
  setWs: React.Dispatch<React.SetStateAction<WebSocket | null>>,
  setMessages: React.Dispatch<React.SetStateAction<WebSocketMessage[]>>,
  setIsReconnecting: React.Dispatch<React.SetStateAction<boolean>>,
  wsRef: React.MutableRefObject<WebSocket | null>,
  pendingMessagesRef: React.MutableRefObject<any[]>,
  hasConnectedOnceRef: React.MutableRefObject<boolean>
) {
  return {
    onConnected: (websocket: WebSocket) => {
      setIsConnected(true);
      setWs(websocket);
      wsRef.current = websocket;
      hasConnectedOnceRef.current = true;
      setIsReconnecting(false);

      // 补发断线期间入队的消息
      const pending = pendingMessagesRef.current;
      if (pending.length > 0) {
        pendingMessagesRef.current = [];
        for (const msg of pending) {
          try {
            websocket.send(JSON.stringify(msg));
          } catch (e) {
            logger.warn('[WebSocket] flush pending send failed:', e);
          }
        }
        logger.info({ count: pending.length }, '[WebSocket] flushed pending messages after reconnect');
      }
    },
    onMessage: (data: any) => {
      setMessages(prev => [...prev, data]);
    },
    onDisconnected: () => {
      setIsConnected(false);
      setWs(null);
      wsRef.current = null;
      // 仅在"曾经连上过"之后才提示重连中（避免首屏加载闪横幅）
      if (hasConnectedOnceRef.current) {
        setIsReconnecting(true);
      }
    }
  };
}

/**
 * React hook for WebSocket connection management.
 * 处理连接、自动重连（心跳探活 + 指数退避）、消息状态、断线发送队列。
 *
 * @param isEnabled - Whether the WebSocket connection should be enabled
 * @returns WebSocket state and functions
 */
export function useWebSocket(isEnabled = true): UseWebSocketResult {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  // Create refs directly in the hook — stable across renders
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const isUnmountedRef = useRef<boolean>(false);
  const isEnabledRef = useRef<boolean>(isEnabled);
  // 心跳 / 退避相关
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missedPongsRef = useRef<number>(0);
  const reconnectAttemptRef = useRef<number>(0);
  // 发送队列 + 重连状态
  const pendingMessagesRef = useRef<any[]>([]);
  const hasConnectedOnceRef = useRef<boolean>(false);

  // Wrap in a stable object via useMemo so callbacks/effects don't re-run
  const refs: WebSocketConnectionRefs = useMemo(() => ({
    wsRef,
    reconnectTimeoutRef,
    isConnectingRef,
    isUnmountedRef,
    isEnabledRef,
    heartbeatTimerRef,
    pongTimerRef,
    missedPongsRef,
    reconnectAttemptRef,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Update enabled ref when prop changes
  useEffect(() => {
    refs.isEnabledRef.current = isEnabled;
  }, [isEnabled, refs.isEnabledRef]);

  // Stable setState references via refs to avoid recreating callbacks
  const stateRefs = useRef({ setIsConnected, setWs, setMessages, setIsReconnecting });
  stateRefs.current = { setIsConnected, setWs, setMessages, setIsReconnecting };

  // Memoized connect function — depends only on stable refs
  const connectCallback = useCallback(() => {
    const callbacks = createConnectionCallbacks(
      stateRefs.current.setIsConnected,
      stateRefs.current.setWs,
      stateRefs.current.setMessages,
      stateRefs.current.setIsReconnecting,
      refs.wsRef,
      pendingMessagesRef,
      hasConnectedOnceRef
    );
    connect(refs, callbacks);
  }, [refs]);

  // Connect/disconnect — only re-run when isEnabled changes
  useEffect(() => {
    if (isEnabled) {
      // Reset unmounted flag when intentionally connecting
      refs.isUnmountedRef.current = false;
      connectCallback();
    }

    return () => {
      refs.isUnmountedRef.current = true;
      refs.isConnectingRef.current = false;
      clearConnectionTimers(refs);
      if (refs.wsRef.current) {
        refs.wsRef.current.close(1000, 'Component unmounted');
        refs.wsRef.current = null;
      }
      pendingMessagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  const sendMessage = useCallback((message: any) => {
    const socket = refs.wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      logger.info('[WebSocket] Sent message:', message.type);
    } else {
      // 未连接：入队，重连后由 onConnected 补发（后端重启等场景防丢）
      pendingMessagesRef.current.push(message);
      logger.warn(
        { type: message.type, queued: pendingMessagesRef.current.length },
        '[WebSocket] not connected, message queued'
      );
    }
  }, [refs.wsRef]);

  return {
    ws,
    sendMessage,
    messages,
    isConnected,
    isReconnecting
  };
}
