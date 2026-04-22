/**
 * Terminal Message Handlers
 *
 * 提供终端WebSocket消息处理和进程退出码提取功能
 *
 * @module features/terminal/hooks/terminalMessageHandlers
 */

import { logger } from '@/shared/utils/logger';
import { buildInitMessage } from '../utils/webSocketFactory';
import type { WebSocketConnectionParams } from './useTerminalConnection';

/**
 * Extract process exit code from terminal output
 * @param output - Raw terminal output
 * @returns Exit code number or null if no exit detected
 */
export function extractExitCode(output: string): number | null {
  const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
  if (cleanOutput.includes('Process exited with code 0')) return 0;
  const match = cleanOutput.match(/Process exited with code (\d+)/);
  const code = match ? parseInt(match[1]) : null;
  return code !== null && code !== 0 ? code : null;
}

/**
 * Create WebSocket message handler for terminal
 */
export function createWebSocketMessageHandler(
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
          const exitCode = extractExitCode(output);
          if (exitCode !== null) onProcessCompleteRef.current(exitCode);
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
 * Configure WebSocket onopen handler with init message
 */
export function configureWebSocketOnOpen(
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

        const initMessage = buildInitMessage({
          selectedProjectRef: params.selectedProjectRef,
          selectedSessionRef: params.selectedSessionRef,
          initialCommandRef: params.initialCommandRef,
          isPlainShellRef: params.isPlainShellRef,
          terminalRef: params.terminalRef
        });

        ws.send(JSON.stringify(initMessage));
      }
    }, 100);
  };
}

/**
 * Configure WebSocket event handlers
 */
export function configureWebSocketHandlers(
  ws: WebSocket,
  params: WebSocketConnectionParams
) {
  configureWebSocketOnOpen(ws, params);

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
