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

  const connectWebSocket = useCallback(async () => {
    if (isConnectingRef.current || isConnected) {
      return;
    }

    isConnectingRef.current = true;
    setIsConnecting(true);

    try {
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
          setIsConnecting(false);
          isConnectingRef.current = false;
          return;
        }

        if (!token) {
          setIsConnecting(false);
          isConnectingRef.current = false;
          return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/shell?token=${encodeURIComponent(token)}`;
      }

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        isConnectingRef.current = false;

        setTimeout(() => {
          if (fitAddonRef.current && terminalRef.current && wsRef.current) {
            fitAddonRef.current.fit();

            wsRef.current!.send(JSON.stringify({
              type: 'init',
              projectPath: selectedProjectRef.current.fullPath || selectedProjectRef.current.path,
              sessionId: isPlainShellRef.current ? null : selectedSessionRef.current?.id,
              hasSession: isPlainShellRef.current ? false : !!selectedSessionRef.current,
              provider: isPlainShellRef.current ? 'plain-shell' : (selectedSessionRef.current?.__provider || 'claude'),
              cols: terminalRef.current.cols,
              rows: terminalRef.current.rows,
              initialCommand: initialCommandRef.current,
              isPlainShell: isPlainShellRef.current
            }));
          }
        }, 100);
      };

      wsRef.current.onmessage = (event) => {
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

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
      };

      wsRef.current.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
      };
    } catch {
      setIsConnected(false);
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [isConnected, onOutput, onUrlOpen, fitAddonRef, terminalRef, selectedProjectRef, selectedSessionRef, initialCommandRef, isPlainShellRef, onProcessCompleteRef]);

  const disconnect = useCallback(() => {
    setUserDisconnected(true);
    isConnectingRef.current = false;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const send = useCallback((data: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    if (isConnectingRef.current || isConnected) {
      return;
    }
    setUserDisconnected(false);
    connectWebSocket();
  }, [isConnected, connectWebSocket]);

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
