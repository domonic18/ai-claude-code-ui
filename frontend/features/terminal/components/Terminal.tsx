/**
 * Shell / Terminal Component
 *
 * Interactive terminal UI component with WebSocket shell support.
 * Connection logic is in hooks/useTerminalConnection.ts
 * Terminal setup is in hooks/useTerminalSetup.ts
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import '@xterm/xterm/css/xterm.css';
import type { ShellProps } from '../types/terminal.types';
import { logger } from '@/shared/utils/logger';
import { useTerminalConnection } from '../hooks/useTerminalConnection';
import { useTerminalSetup } from '../hooks/useTerminalSetup';

/** Inject xterm style overrides at module load */
const xtermStyles = `
  .xterm .xterm-screen { outline: none !important; }
  .xterm:focus .xterm-screen { outline: none !important; }
  .xterm-screen:focus { outline: none !important; }
  .xterm { z-index: 1; }
  .xterm-link-layer { z-index: 2; }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = xtermStyles;
  document.head.appendChild(styleSheet);
}

function Shell({
  selectedProject,
  selectedSession,
  initialCommand,
  isPlainShell = false,
  onProcessComplete,
  minimal = false,
  autoConnect = false,
  isActive = false
}: ShellProps) {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  // Refs for stable callback access
  const selectedProjectRef = useRef(selectedProject);
  const selectedSessionRef = useRef(selectedSession);
  const initialCommandRef = useRef(initialCommand);
  const isPlainShellRef = useRef(isPlainShell);
  const onProcessCompleteRef = useRef(onProcessComplete);

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
    selectedSessionRef.current = selectedSession;
    initialCommandRef.current = initialCommand;
    isPlainShellRef.current = isPlainShell;
    onProcessCompleteRef.current = onProcessComplete;
  });

  // Connection hook — created first so its send function is available
  const connectionSendRef = useRef<(data: object) => void>(() => {});

  // Terminal setup hook
  const { terminalRef, terminal, fitAddon } = useTerminalSetup({
    initKey: selectedProject?.path || selectedProject?.fullPath || '',
    isRestarting,
    onInput: useCallback((data: string) => {
      connectionSendRef.current({ type: 'input', data });
    }, []),
    onResize: useCallback((cols: number, rows: number) => {
      connectionSendRef.current({ type: 'resize', cols, rows });
    }, []),
    autoConnect,
    onInitialized: () => setIsInitialized(true),
    send: (data: object) => {
      connectionSendRef.current(data);
    },
  });

  // Connection hook
  const { isConnected, isConnecting, userDisconnected, connect, disconnect, send: connectionSend } = useTerminalConnection({
    onOutput: useCallback((output: string) => {
      if (terminal.current) {
        terminal.current.write(output);
      }
    }, [terminal]),
    onUrlOpen: useCallback((url: string) => {
      window.open(url, '_blank');
    }, []),
    selectedProjectRef,
    selectedSessionRef,
    initialCommandRef,
    isPlainShellRef,
    onProcessCompleteRef,
    fitAddonRef: fitAddon,
    terminalRef: terminal,
  });

  // Wire up the connection send function so setup hook callbacks can use it
  connectionSendRef.current = connectionSend;

  // Session display names
  const sessionDisplayName = useMemo(() => {
    if (!selectedSession) return null;
    return selectedSession.__provider === 'cursor'
      ? (selectedSession.name || 'Untitled Session')
      : (selectedSession.summary || 'New Session');
  }, [selectedSession]);

  const sessionDisplayNameShort = useMemo(() => {
    return sessionDisplayName?.slice(0, 30) ?? null;
  }, [sessionDisplayName]);

  const sessionDisplayNameLong = useMemo(() => {
    return sessionDisplayName?.slice(0, 50) ?? null;
  }, [sessionDisplayName]);

  // Restart handler
  const restartShell = useCallback(() => {
    setIsRestarting(true);

    disconnect();

    if (terminal.current) {
      terminal.current.dispose();
      terminal.current = null;
      fitAddon.current = null;
    }

    setIsInitialized(false);
    setTimeout(() => setIsRestarting(false), 200);
  }, [disconnect, terminal, fitAddon]);

  // Disconnect with terminal clear
  const disconnectFromShell = useCallback(() => {
    disconnect();
    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[2J\x1b[H');
    }
  }, [disconnect, terminal]);

  // Auto-reconnect on session change
  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      disconnectFromShell();
    }
    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized, disconnectFromShell, lastSessionId]);

  // Auto-connect effect
  useEffect(() => {
    if (userDisconnected) return;
    if (!autoConnect || !isInitialized || isConnecting || isConnected) return;
    connect();
  }, [autoConnect, isInitialized, isConnecting, isConnected, connect, userDisconnected]);

  // --- Render ---

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Select a Project</h3>
          <p>Choose a project to open an interactive shell in that directory</p>
        </div>
      </div>
    );
  }

  if (minimal) {
    return (
      <div className="h-full w-full bg-gray-900">
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 w-full">
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {selectedSession && (
              <span className="text-xs text-blue-300">
                ({sessionDisplayNameShort}...)
              </span>
            )}
            {!selectedSession && (
              <span className="text-xs text-gray-400">(New Session)</span>
            )}
            {!isInitialized && (
              <span className="text-xs text-yellow-400">(Initializing...)</span>
            )}
            {isRestarting && (
              <span className="text-xs text-blue-400">(Restarting...)</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {isConnected && (
              <button
                onClick={disconnectFromShell}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1"
                title="Disconnect from shell"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Disconnect</span>
              </button>
            )}

            <button
              onClick={restartShell}
              disabled={isRestarting || isConnected}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              title="Restart Shell (disconnect first)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Restart</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 overflow-hidden relative">
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />

        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-50">
            <div className="text-white">Loading terminal...</div>
          </div>
        )}

        {isInitialized && !isConnected && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4 z-40">
            <div className="text-center max-w-sm w-full">
              <button
                onClick={connect}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-base font-medium w-full sm:w-auto"
                title="Connect to shell"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Continue in Shell</span>
              </button>
              <p className="text-gray-400 text-sm mt-3 px-2">
                {isPlainShell ?
                  `Run ${initialCommand || 'command'} in ${selectedProject.displayName}` :
                  selectedSession ?
                    `Resume session: ${sessionDisplayNameLong}...` :
                    'Start a new Claude session'
                }
              </p>
            </div>
          </div>
        )}

        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
            <div className="text-center max-w-sm w-full">
              <div className="flex items-center justify-center space-x-3 text-yellow-400">
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
                <span className="text-base font-medium">Connecting to shell...</span>
              </div>
              <p className="text-gray-400 text-sm mt-3 px-2">
                {isPlainShell ?
                  `Running ${initialCommand || 'command'} in ${selectedProject.displayName}` :
                  `Starting Claude CLI in ${selectedProject.displayName}`
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Shell;
export { Shell as Terminal, Shell };
