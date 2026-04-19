/**
 * useTerminalConnection Hook
 *
 * Custom hook for managing WebSocket connections to the terminal shell.
 * Handles connection, disconnection, token fetching, and message handling.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/shared/utils/logger';

/**
 * Hook return type
 */
export interface TerminalConnection {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Whether user explicitly disconnected */
  userDisconnected: boolean;
  /** Connect to the shell WebSocket */
  connect: () => void;
  /** Disconnect from the shell WebSocket */
  disconnect: () => void;
  /** Send data through the WebSocket */
  send: (data: object) => void;
  /** WebSocket ready state */
  readyState: number;
}

interface UseTerminalConnectionOptions {
  /** Called when terminal output is received */
  onOutput?: (output: string) => void;
  /** Called when URL open request is received */
  onUrlOpen?: (url: string) => void;
  /** Refs for accessing current props without re-creating callbacks */
  selectedProjectRef: React.MutableRefObject<any>;
  selectedSessionRef: React.MutableRefObject<any>;
  initialCommandRef: React.MutableRefObject<string | undefined>;
  isPlainShellRef: React.MutableRefObject<boolean>;
  onProcessCompleteRef: React.MutableRefObject<((code: number) => void) | undefined>;
  /** Terminal refs for resize on connect */
  fitAddonRef: React.MutableRefObject<any>;
  terminalRef: React.MutableRefObject<any>;
}

/**
 * Create WebSocket message handler for terminal
 */
function createWebSocketMessageHandler(
  isPlainShellRef: React.MutableRefObject<boolean>,
  onProcessCompleteRef: React.MutableRefObject<((code: number) => void) | undefined>,
  onOutput?: (output: string) => void,
  onUrlOpen?: (url: string) => void
) {
  return (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'output') {
        const output = data.data;

        if (isPlainShellRef.current && onProcessCompleteRef.current) {
          const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
          if (cleanOutput.includes('Process exited with code 0')) {
            onProcessCompleteRef.current(0);
          } else if (cleanOutput.match(/Process exited with code (\d+)/)) {
            const exitCode = parseInt(cleanOutput.match(/Process exited with code (\d+)/)[1]);
            if (exitCode !== 0) {
              onProcessCompleteRef.current(exitCode);
            }
          }
        }

        onOutput?.(output);
      } else if (data.type === 'url_open') {
        onUrlOpen?.(data.url);
      }
    } catch (error) {
      logger.error('[Shell] Error handling WebSocket message:', error, event.data);
    }
  };
}

/**
 * Configure WebSocket event handlers
 */
function configureWebSocketHandlers(
  ws: WebSocket,
  params: WebSocketConnectionParams
) {
  ws.onopen = () => {
    params.setIsConnected(true);
    params.setIsConnecting(false);
    params.isConnectingRef.current = false;

    setTimeout(() => {
      if (params.fitAddonRef.current && params.terminalRef.current && ws) {
        params.fitAddonRef.current.fit();

        ws.send(JSON.stringify({
          type: 'init',
          projectPath: params.selectedProjectRef.current.fullPath || params.selectedProjectRef.current.path,
          sessionId: params.isPlainShellRef.current ? null : params.selectedSessionRef.current?.id,
          hasSession: params.isPlainShellRef.current ? false : !!params.selectedSessionRef.current,
          provider: params.isPlainShellRef.current ? 'plain-shell' : (params.selectedSessionRef.current?.__provider || 'claude'),
          cols: params.terminalRef.current.cols,
          rows: params.terminalRef.current.rows,
          initialCommand: params.initialCommandRef.current,
          isPlainShell: params.isPlainShellRef.current
        }));
      }
    }, 100);
  };

  ws.onmessage = createWebSocketMessageHandler(
    params.isPlainShellRef,
    params.onProcessCompleteRef,
    params.onOutput,
    params.onUrlOpen
  );

  ws.onclose = () => {
    params.setIsConnected(false);
    params.setIsConnecting(false);
    params.isConnectingRef.current = false;
  };

  ws.onerror = () => {
    params.setIsConnected(false);
    params.setIsConnecting(false);
    params.isConnectingRef.current = false;
  };
}

/**
 * Establish WebSocket connection for terminal
 */
interface WebSocketConnectionParams {
  isConnected: boolean;
  isConnectingRef: React.MutableRefObject<boolean>;
  setIsConnected: (state: boolean) => void;
  setIsConnecting: (state: boolean) => void;
  selectedProjectRef: React.MutableRefObject<any>;
  selectedSessionRef: React.MutableRefObject<any>;
  initialCommandRef: React.MutableRefObject<string | undefined>;
  isPlainShellRef: React.MutableRefObject<boolean>;
  fitAddonRef: React.MutableRefObject<any>;
  terminalRef: React.MutableRefObject<any>;
  onOutput?: (output: string) => void;
  onUrlOpen?: (url: string) => void;
  onProcessCompleteRef: React.MutableRefObject<((code: number) => void) | undefined>;
}

async function establishWebSocketConnection(
  params: WebSocketConnectionParams
): Promise<WebSocket | null> {
  const {
    isConnected,
    isConnectingRef,
    setIsConnected,
    setIsConnecting,
  } = params;

  if (isConnectingRef.current || isConnected) {
    return null;
  }

  isConnectingRef.current = true;
  setIsConnecting(true);

  try {
    const ws = await createWebSocket();
    if (!ws) {
      setIsConnecting(false);
      isConnectingRef.current = false;
      return null;
    }

    configureWebSocketHandlers(ws, params);
    return ws;
  } catch {
    setIsConnected(false);
    setIsConnecting(false);
    isConnectingRef.current = false;
    return null;
  }
}

/**
 * Create WebSocket connection with proper URL and token
 */
async function createWebSocket(): Promise<WebSocket | null> {
  const isPlatform = import.meta.env.VITE_IS_PLATFORM === 'true';
  let wsUrl: string;

  if (isPlatform) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/shell`;
  } else {
    let token: string | undefined;
    try {
      const response = await fetch('/api/auth/ws-token', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        token = data.data?.token;
      }
    } catch (error) {
      logger.error('[Shell] Error fetching ws-token:', error);
      return null;
    }

    if (!token) {
      return null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/shell?token=${encodeURIComponent(token)}`;
  }

  return new WebSocket(wsUrl);
}

/**
 * Custom hook for terminal WebSocket connection callbacks
 */
function useTerminalConnectionCallbacks(
  wsRef: React.MutableRefObject<WebSocket | null>,
  isConnected: boolean,
  isConnectingRef: React.MutableRefObject<boolean>,
  setIsConnected: (state: boolean) => void,
  setIsConnecting: (state: boolean) => void,
  setUserDisconnected: (state: boolean) => void,
  params: WebSocketConnectionParams
) {
  const connectWebSocket = useCallback(async () => {
    const ws = await establishWebSocketConnection(params);

    if (ws) {
      wsRef.current = ws;
    }
  }, [params, wsRef]);

  const disconnect = useCallback(() => {
    setUserDisconnected(true);
    isConnectingRef.current = false;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, [setUserDisconnected, setIsConnected, setIsConnecting]);

  const send = useCallback((data: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, [wsRef]);

  const connect = useCallback(() => {
    if (isConnectingRef.current || isConnected) {
      return;
    }
    setUserDisconnected(false);
    connectWebSocket();
  }, [isConnected, isConnectingRef, setUserDisconnected, connectWebSocket]);

  return { connect, disconnect, send };
}

/**
 * Custom hook for terminal WebSocket connection management
 */
export function useTerminalConnection(options: UseTerminalConnectionOptions): TerminalConnection {
  const {
    onOutput,
    onUrlOpen,
    selectedProjectRef,
    selectedSessionRef,
    initialCommandRef,
    isPlainShellRef,
    onProcessCompleteRef,
    fitAddonRef,
    terminalRef,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userDisconnected, setUserDisconnected] = useState(false);
  const isConnectingRef = useRef(false);

  const wsParams: WebSocketConnectionParams = {
    isConnected,
    isConnectingRef,
    setIsConnected,
    setIsConnecting,
    selectedProjectRef,
    selectedSessionRef,
    initialCommandRef,
    isPlainShellRef,
    fitAddonRef,
    terminalRef,
    onOutput,
    onUrlOpen,
    onProcessCompleteRef
  };

  const { connect, disconnect, send } = useTerminalConnectionCallbacks(
    wsRef,
    isConnected,
    isConnectingRef,
    setIsConnected,
    setIsConnecting,
    setUserDisconnected,
    wsParams
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    userDisconnected,
    connect,
    disconnect,
    send,
    readyState: wsRef.current?.readyState ?? WebSocket.CONNECTING,
  };
}
