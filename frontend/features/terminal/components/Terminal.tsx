/**
 * Shell / Terminal Component
 *
 * Interactive terminal UI component with WebSocket shell support.
 * Connection logic is in hooks/useTerminalConnection.ts
 * Terminal setup is in hooks/useTerminalSetup.ts
 */

import React, { useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import type { ShellProps } from '../types/terminal.types';
import { useShellLogic } from '../hooks/useShellLogic';
import { TerminalToolbar } from './TerminalToolbar';
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

/**
 * Empty state when no project is selected
 */
const NoProjectSelected: React.FC = () => (
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

/**
 * Overlay shown when terminal is connecting
 */
interface ConnectingOverlayProps {
  isPlainShell: boolean;
  initialCommand?: string;
  displayName: string;
}

const ConnectingOverlay: React.FC<ConnectingOverlayProps> = ({
  isPlainShell,
  initialCommand,
  displayName
}) => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
    <div className="text-center max-w-sm w-full">
      <div className="flex items-center justify-center space-x-3 text-yellow-400">
        <div className="w-6 h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
        <span className="text-base font-medium">Connecting to shell...</span>
      </div>
      <p className="text-gray-400 text-sm mt-3 px-2">
        {isPlainShell ?
          `Running ${initialCommand || 'command'} in ${displayName}` :
          `Starting Claude CLI in ${displayName}`
        }
      </p>
    </div>
  </div>
);

/**
 * Prompt shown when terminal is ready but not connected
 */
interface ConnectPromptProps {
  onConnect: () => void;
  isPlainShell: boolean;
  initialCommand?: string;
  displayName: string;
  sessionDisplayName: string | null;
}

const ConnectPrompt: React.FC<ConnectPromptProps> = ({
  onConnect,
  isPlainShell,
  initialCommand,
  displayName,
  sessionDisplayName
}) => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4 z-40">
    <div className="text-center max-w-sm w-full">
      <button
        onClick={onConnect}
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
          `Run ${initialCommand || 'command'} in ${displayName}` :
          sessionDisplayName ?
            `Resume session: ${sessionDisplayName}...` :
            'Start a new Claude session'
        }
      </p>
    </div>
  </div>
);

/**
 * 终端 Shell 主组件：管理 xterm 实例、WebSocket 连接、工具栏和状态覆层
 */
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
  const terminal = useRef<ReturnType<typeof useTerminalSetup>['terminal']['current']>(null);
  const shellState = useShellLogic({
    selectedProject,
    selectedSession,
    initialCommand,
    isPlainShell,
    onProcessComplete,
    autoConnect,
    terminal
  });

  if (!selectedProject) {
    return <NoProjectSelected />;
  }

  if (minimal) {
    return <MinimalTerminal terminalRef={shellState.terminalRef} />;
  }

  return (
    <TerminalShell
      terminalRef={shellState.terminalRef}
      isConnected={shellState.isConnected}
      isInitialized={shellState.isInitialized}
      isRestarting={shellState.isRestarting}
      isConnecting={shellState.isConnecting}
      selectedSession={selectedSession}
      selectedProject={selectedProject}
      isPlainShell={isPlainShell}
      initialCommand={initialCommand}
      sessionDisplayNameLong={shellState.sessionDisplayNameLong}
      onDisconnect={shellState.disconnectFromShell}
      onRestart={shellState.restartShell}
      onConnect={shellState.connect}
    />
  );
}

/**
 * Minimal terminal view without toolbar
 */
interface MinimalTerminalProps {
  terminalRef: React.RefObject<HTMLDivElement>;
}

const MinimalTerminal: React.FC<MinimalTerminalProps> = ({ terminalRef }) => (
  <div className="h-full w-full bg-gray-900">
    <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />
  </div>
);

/**
 * Full terminal view with toolbar and overlays
 */
interface TerminalShellProps {
  terminalRef: React.RefObject<HTMLDivElement>;
  isConnected: boolean;
  isInitialized: boolean;
  isRestarting: boolean;
  isConnecting: boolean;
  selectedSession: ShellProps['selectedSession'];
  selectedProject: NonNullable<ShellProps['selectedProject']>;
  isPlainShell: boolean;
  initialCommand?: string;
  sessionDisplayNameLong: string | null;
  onDisconnect: () => void;
  onRestart: () => void;
  onConnect: () => void;
}

const TerminalShell: React.FC<TerminalShellProps> = ({
  terminalRef,
  isConnected,
  isInitialized,
  isRestarting,
  isConnecting,
  selectedSession,
  selectedProject,
  isPlainShell,
  initialCommand,
  sessionDisplayNameLong,
  onDisconnect,
  onRestart,
  onConnect
}) => (
  <div className="h-full flex flex-col bg-gray-900 w-full">
    <TerminalToolbar
      isConnected={isConnected}
      isInitialized={isInitialized}
      isRestarting={isRestarting}
      selectedSession={selectedSession}
      onDisconnect={onDisconnect}
      onRestart={onRestart}
    />

    <div className="flex-1 p-2 overflow-hidden relative">
      <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />

      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-50">
          <div className="text-white">Loading terminal...</div>
        </div>
      )}

      {isInitialized && !isConnected && !isConnecting && (
        <ConnectPrompt
          onConnect={onConnect}
          isPlainShell={isPlainShell}
          initialCommand={initialCommand}
          displayName={selectedProject.displayName}
          sessionDisplayName={sessionDisplayNameLong}
        />
      )}

      {isConnecting && (
        <ConnectingOverlay
          isPlainShell={isPlainShell}
          initialCommand={initialCommand}
          displayName={selectedProject.displayName}
        />
      )}
    </div>
  </div>
);

export default Shell;
export { Shell as Terminal, Shell };
