/**
 * Custom hook to manage shell state and effects
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ShellProps } from '../types/terminal.types';
import { useTerminalConnection } from './useTerminalConnection';
import { useTerminalSetup } from './useTerminalSetup';

/**
 * Sync refs with current props
 */
function useSyncRefs(
  selectedProject: ShellProps['selectedProject'],
  selectedSession: ShellProps['selectedSession'],
  initialCommand: string | undefined,
  isPlainShell: boolean,
  onProcessComplete: ShellProps['onProcessComplete'] | undefined,
) {
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

  return { selectedProjectRef, selectedSessionRef, initialCommandRef, isPlainShellRef, onProcessCompleteRef };
}

/**
 * Auto-reconnect on session change
 */
function useAutoReconnect(
  selectedSession: ShellProps['selectedSession'],
  isInitialized: boolean,
  disconnectFromShell: () => void
) {
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      disconnectFromShell();
    }
    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized, disconnectFromShell, lastSessionId]);
}

/**
 * Auto-connect when conditions are met
 */
function useAutoConnect(
  autoConnect: boolean,
  isInitialized: boolean,
  isConnecting: boolean,
  isConnected: boolean,
  userDisconnected: boolean,
  connect: () => void
) {
  useEffect(() => {
    if (userDisconnected) return;
    if (!autoConnect || !isInitialized || isConnecting || isConnected) return;
    connect();
  }, [autoConnect, isInitialized, isConnecting, isConnected, connect, userDisconnected]);
}

/**
 * Create input and resize callbacks
 */
function useTerminalCallbacks(connectionSendRef: React.MutableRefObject<(data: object) => void>) {
  const onInput = useCallback((data: string) => {
    connectionSendRef.current({ type: 'input', data });
  }, []);

  const onResize = useCallback((cols: number, rows: number) => {
    connectionSendRef.current({ type: 'resize', cols, rows });
  }, []);

  return { onInput, onResize };
}

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

  const refs = useSyncRefs(selectedProject, selectedSession, initialCommand, isPlainShell, onProcessComplete);
  const connectionSendRef = useRef<(data: object) => void>(() => {});
  const { onInput, onResize } = useTerminalCallbacks(connectionSendRef);

  // Terminal setup hook
  const { terminalRef, fitAddon } = useTerminalSetup({
    initKey: selectedProject?.path || selectedProject?.fullPath || '',
    isRestarting, onInput, onResize, autoConnect,
    onInitialized: () => setIsInitialized(true),
    send: (data: object) => connectionSendRef.current(data),
  });

  // Connection hook
  const { isConnected, isConnecting, userDisconnected, connect, disconnect, send: connectionSend } = useTerminalConnection({
    onOutput: useCallback((output: string) => { terminal.current?.write(output); }, [terminal]),
    onUrlOpen: useCallback((url: string) => { window.open(url, '_blank'); }, []),
    ...refs, fitAddonRef: fitAddon, terminalRef: terminal,
  });

  connectionSendRef.current = connectionSend;

  const sessionDisplayNameLong = useMemo(() => {
    if (!selectedSession) return null;
    const name = selectedSession.__provider === 'cursor'
      ? (selectedSession.name || 'Untitled Session') : (selectedSession.summary || 'New Session');
    return name.slice(0, 50) ?? null;
  }, [selectedSession]);

  const restartShell = useCallback(() => {
    setIsRestarting(true); disconnect();
    if (terminal.current) { terminal.current.dispose(); terminal.current = null; fitAddon.current = null; }
    setIsInitialized(false);
    setTimeout(() => setIsRestarting(false), 200);
  }, [disconnect, terminal, fitAddon]);

  const disconnectFromShell = useCallback(() => {
    disconnect();
    if (terminal.current) { terminal.current.clear(); terminal.current.write('\x1b[2J\x1b[H'); }
  }, [disconnect, terminal]);

  useAutoReconnect(selectedSession, isInitialized, disconnectFromShell);
  useAutoConnect(autoConnect, isInitialized, isConnecting, isConnected, userDisconnected, connect);

  return {
    terminalRef, isConnected, isConnecting, isInitialized, isRestarting,
    sessionDisplayNameLong, restartShell, disconnectFromShell, connect,
  };
}
