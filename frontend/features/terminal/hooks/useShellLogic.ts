/**
 * Custom hook to manage shell state and effects
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ShellProps } from '../types/terminal.types';
import { useTerminalConnection } from './useTerminalConnection';
import { useTerminalSetup } from './useTerminalSetup';

export function useShellLogic({
  selectedProject,
  selectedSession,
  initialCommand,
  isPlainShell,
  onProcessComplete,
  autoConnect,
  terminal
}: {
  selectedProject: ShellProps['selectedProject'];
  selectedSession: ShellProps['selectedSession'];
  initialCommand?: string;
  isPlainShell: boolean;
  onProcessComplete?: ShellProps['onProcessComplete'];
  autoConnect: boolean;
  terminal: React.MutableRefObject<ReturnType<typeof useTerminalSetup>['terminal']['current']>;
}) {
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

  // Connection hook - created first so its send function is available
  const connectionSendRef = useRef<(data: object) => void>(() => {});

  // Terminal setup hook
  const { terminalRef, fitAddon } = useTerminalSetup({
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
  const sessionDisplayNameLong = useMemo(() => {
    if (!selectedSession) return null;
    const displayName = selectedSession.__provider === 'cursor'
      ? (selectedSession.name || 'Untitled Session')
      : (selectedSession.summary || 'New Session');
    return displayName.slice(0, 50) ?? null;
  }, [selectedSession]);

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

  return {
    terminalRef,
    isConnected,
    isConnecting,
    isInitialized,
    isRestarting,
    sessionDisplayNameLong,
    restartShell,
    disconnectFromShell,
    connect
  };
}
