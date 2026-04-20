/**
 * Terminal Operations
 *
 * Terminal operation functions (execute, write, resize, kill)
 * Extracted from useTerminal.ts to reduce complexity.
 *
 * @module features/terminal/hooks/useTerminalOperations
 */

import { useCallback } from 'react';
import type { TerminalProcess, TerminalOutput } from '../types';
import { logger } from '@/shared/utils/logger';

/**
 * Generate unique output ID
 * @returns Unique ID string
 */
function generateOutputId(): string {
  return `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add output to state
 * @param output - Output data without id and timestamp
 * @param isMountedRef - Ref to track if component is mounted
 * @param setOutputs - State setter for outputs
 * @param onOutput - Optional callback when output is added
 */
export function addOutput(
  output: Omit<TerminalOutput, 'id' | 'timestamp'>,
  isMountedRef: React.RefObject<boolean>,
  setOutputs: React.Dispatch<React.SetStateAction<TerminalOutput[]>>,
  onOutput?: (output: TerminalOutput) => void
): void {
  const newOutput: TerminalOutput = {
    id: generateOutputId(),
    timestamp: new Date(),
    ...output,
  };

  if (isMountedRef.current) {
    setOutputs(prev => [...prev, newOutput]);
    onOutput?.(newOutput);
  }
}

/**
 * Execute command through WebSocket
 * @param wsRef - WebSocket ref
 * @param isConnected - Connection status
 * @param command - Command to execute
 * @param args - Command arguments
 * @param cwd - Working directory
 * @param env - Environment variables
 * @param process - Current process
 * @param setProcess - Process state setter
 * @param setIsLoading - Loading state setter
 * @param setError - Error state setter
 * @param onError - Optional error callback
 */
export async function executeCommandViaWebSocket(
  wsRef: React.RefObject<WebSocket>,
  isConnected: boolean,
  command: string,
  args: string[],
  cwd: string | undefined,
  env: Record<string, string> | undefined,
  process: TerminalProcess | null,
  setProcess: React.Dispatch<React.SetStateAction<TerminalProcess | null>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
  onError?: (error: Error) => void
): Promise<void> {
  if (!wsRef.current || !isConnected) {
    const error = new Error('Terminal not connected');
    setError(error);
    onError?.(error);
    throw error;
  }

  setIsLoading(true);
  setError(null);

  const newProcess: TerminalProcess = {
    id: `process-${Date.now()}`,
    command,
    args,
    status: 'running',
    cwd: cwd || process?.cwd,
    env: env || process?.env,
  };

  setProcess(newProcess);

  try {
    wsRef.current.send(JSON.stringify({
      type: 'command',
      command,
      args,
      cwd,
      env,
    }));
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Failed to execute command');
    setError(error);
    onError?.(error);
    setIsLoading(false);
    throw error;
  }
}

/**
 * Send input to terminal
 * @param wsRef - WebSocket ref
 * @param isConnected - Connection status
 * @param input - Input string
 */
export function writeInputToWebSocket(
  wsRef: React.RefObject<WebSocket>,
  isConnected: boolean,
  input: string
): void {
  if (!wsRef.current || !isConnected) {
    return;
  }

  try {
    wsRef.current.send(JSON.stringify({
      type: 'input',
      data: input,
    }));
  } catch (err) {
    logger.error('Failed to write input:', err);
  }
}

/**
 * Resize terminal
 * @param wsRef - WebSocket ref
 * @param isConnected - Connection status
 * @param cols - Number of columns
 * @param rows - Number of rows
 */
export function resizeTerminalWebSocket(
  wsRef: React.RefObject<WebSocket>,
  isConnected: boolean,
  cols: number,
  rows: number
): void {
  if (!wsRef.current || !isConnected) {
    return;
  }

  try {
    wsRef.current.send(JSON.stringify({
      type: 'resize',
      cols,
      rows,
    }));
  } catch (err) {
    logger.error('Failed to resize terminal:', err);
  }
}

/**
 * Kill process
 * @param wsRef - WebSocket ref
 * @param isConnected - Connection status
 */
export function killProcessViaWebSocket(
  wsRef: React.RefObject<WebSocket>,
  isConnected: boolean
): void {
  if (!wsRef.current || !isConnected) {
    return;
  }

  try {
    wsRef.current.send(JSON.stringify({
      type: 'signal',
      signal: 'SIGTERM',
    }));
  } catch (err) {
    logger.error('Failed to kill process:', err);
  }
}

/**
 * Create terminal operations hooks
 * @param wsRef - WebSocket ref
 * @param isConnected - Connection status
 * @param process - Current process
 * @param args - Command arguments
 * @param cwd - Working directory
 * @param env - Environment variables
 * @param setProcess - Process state setter
 * @param setIsLoading - Loading state setter
 * @param setError - Error state setter
 * @param setOutputs - Outputs state setter
 * @param isMountedRef - Mounted ref
 * @param onError - Optional error callback
 * @param onOutput - Optional output callback
 * @returns Terminal operations object
 */
export function createTerminalOperations(
  wsRef: React.RefObject<WebSocket>,
  isConnected: boolean,
  process: TerminalProcess | null,
  args: string[],
  cwd: string | undefined,
  env: Record<string, string> | undefined,
  setProcess: React.Dispatch<React.SetStateAction<TerminalProcess | null>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
  setOutputs: React.Dispatch<React.SetStateAction<TerminalOutput[]>>,
  isMountedRef: React.RefObject<boolean>,
  onError?: (error: Error) => void,
  onOutput?: (output: TerminalOutput) => void
) {
  const addOutputCallback = useCallback((output: Omit<TerminalOutput, 'id' | 'timestamp'>) => {
    addOutput(output, isMountedRef, setOutputs, onOutput);
  }, [onOutput]);

  const executeCommandCallback = useCallback(async (command: string, cmdArgs?: string[]) => {
    await executeCommandViaWebSocket(
      wsRef,
      isConnected,
      command,
      cmdArgs || args,
      cwd,
      env,
      process,
      setProcess,
      setIsLoading,
      setError,
      onError
    );
  }, [isConnected, cwd, env, args, process, onError]);

  const writeInputCallback = useCallback((input: string) => {
    writeInputToWebSocket(wsRef, isConnected, input);
  }, [isConnected]);

  const resizeTerminalCallback = useCallback((cols: number, rows: number) => {
    resizeTerminalWebSocket(wsRef, isConnected, cols, rows);
  }, [isConnected]);

  const killProcessCallback = useCallback(() => {
    killProcessViaWebSocket(wsRef, isConnected);
  }, [isConnected]);

  return {
    addOutput: addOutputCallback,
    executeCommand: executeCommandCallback,
    writeInput: writeInputCallback,
    resizeTerminal: resizeTerminalCallback,
    killProcess: killProcessCallback,
  };
}
