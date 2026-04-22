/**
 * TerminalToolbar Component
 *
 * Toolbar component for the terminal/shell interface.
 * Displays connection status, session info, and control buttons.
 * 终端工具栏组件，显示连接状态、会话信息和控制按钮
 */

import React from 'react';

/**
 * Session type (inline definition from ShellProps)
 * 会话类型定义（来自 ShellProps 的内联定义）
 */
type Session = {
  id: string;              // 会话唯一标识符
  __provider?: string;     // 会话提供者（cursor、claude 等）
  name?: string;           // Cursor 会话名称
  summary?: string;        // Claude 会话摘要
};

/**
 * Props for TerminalToolbar component
 * 终端工具栏组件的 Props
 */
interface TerminalToolbarProps {
  /** Whether the terminal is connected - 终端是否已连接 */
  isConnected: boolean;
  /** Whether the terminal is being initialized - 终端是否正在初始化 */
  isInitialized: boolean;
  /** Whether the terminal is restarting - 终端是否正在重启 */
  isRestarting: boolean;
  /** Currently selected session (optional) - 当前选中的会话 */
  selectedSession?: Session | null;
  /** Handler for disconnect button - 断开连接按钮的处理函数 */
  onDisconnect: () => void;
  /** Handler for restart button - 重启按钮的处理函数 */
  onRestart: () => void;
}

/**
 * TerminalToolbar Component
 *
 * Displays the terminal toolbar with status indicator and action buttons.
 *
 * @param props - Component props
 * @returns JSX.Element
 *
 * @example
 * ```tsx
 * <TerminalToolbar
 *   isConnected={true}
 *   isInitialized={true}
 *   isRestarting={false}
 *   selectedSession={session}
 *   onDisconnect={handleDisconnect}
 *   onRestart={handleRestart}
 * />
 * ```
 */
export function TerminalToolbar({
  isConnected,
  isInitialized,
  isRestarting,
  selectedSession,
  onDisconnect,
  onRestart,
}: TerminalToolbarProps): React.ReactElement {
  // Session display names
  // 根据会话提供者类型计算会话显示名称
  const sessionDisplayName = React.useMemo(() => {
    if (!selectedSession) return null;
    // Cursor 会话使用 name 字段
    return selectedSession.__provider === 'cursor'
      ? (selectedSession.name || 'Untitled Session')
      // Claude 会话使用 summary 字段
      : (selectedSession.summary || 'New Session');
  }, [selectedSession]);

  // 会话显示名称的短版本（限制为 30 个字符）
  const sessionDisplayNameShort = React.useMemo(() => {
    return sessionDisplayName?.slice(0, 30) ?? null;
  }, [sessionDisplayName]);

  return (
    <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Status indicator and session info */}
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

        {/* Action buttons */}
        <div className="flex items-center space-x-3">
          {isConnected && (
            <button
              onClick={onDisconnect}
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
            onClick={onRestart}
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
  );
}

export default TerminalToolbar;
