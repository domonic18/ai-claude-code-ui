/**
 * Shell / Terminal Component
 *
 * 终端 Shell 主组件
 *
 * 这是一个基于 xterm.js 的交互式终端组件，通过 WebSocket 与后端建立持久连接
 * 支持两种模式：
 * 1. Claude CLI 模式：完整的 AI 辅助命令行体验
 * 2. Plain Shell 模式：直接执行 shell 命令
 *
 * 架构分层：
 * - 连接逻辑：hooks/useTerminalConnection.ts
 * - 终端设置：hooks/useTerminalSetup.ts
 * - 业务逻辑：hooks/useShellLogic.ts
 */

// 导入 React 核心库和 useRef Hook
import React, { useRef } from 'react';
// 导入 xterm.js 的默认样式表
import '@xterm/xterm/css/xterm.css';
// 导入终端组件的 Props 类型定义
import type { ShellProps } from '../types/terminal.types';
// 导入终端业务逻辑 Hook（管理连接、初始化、状态）
import { useShellLogic } from '../hooks/useShellLogic';
// 导入终端工具栏组件
import { TerminalToolbar } from './TerminalToolbar';
// 导入终端设置 Hook（管理 xterm.js 实例）
import { useTerminalSetup } from '../hooks/useTerminalSetup';

/** 在模块加载时注入 xterm.js 样式覆盖 */
// 移除 xterm.js 默认的 focus outline，避免视觉干扰
// 设置适当的 z-index 确保 terminal 和链接层的层级正确
const xtermStyles = `
  .xterm .xterm-screen { outline: none !important; }
  .xterm:focus .xterm-screen { outline: none !important; }
  .xterm-screen:focus { outline: none !important; }
  .xterm { z-index: 1; }
  .xterm-link-layer { z-index: 2; }
`;

// 仅在浏览器环境中注入样式
// 检查 document 是否存在，避免 SSR（服务端渲染）时报错
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = xtermStyles;
  document.head.appendChild(styleSheet);
}

/**
 * 空状态占位组件
 * 当用户未选择项目时显示，引导用户选择项目以打开终端
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
 * 连接中状态覆层组件
 * 显示正在建立 WebSocket 连接的加载动画和提示信息
 * 包含两种场景的提示文案：普通 Shell 和 Claude CLI
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
 * 连接提示组件
 * 当终端已初始化但尚未连接时显示，提供"Continue in Shell"按钮
 * 用户需要主动点击按钮才会发起连接，给予用户控制权
 * 显示当前会话信息（如果有）和即将执行的操作
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
 * 终端 Shell 主组件
 *
 * 该组件是终端功能的核心控制器，负责：
 * 1. 协调 xterm.js 实例的创建和销毁
 * 2. 管理 WebSocket 连接的生命周期
 * 3. 渲染工具栏和各种状态覆层（连接中、已初始化、空状态）
 * 4. 处理用户交互（断开连接、重启 Shell）
 *
 * 根据不同的 props 组合，可以渲染为：
 * - 空状态（无项目）
 * - 最小化模式（minimal=true，无工具栏）
 * - 完整模式（带工具栏和状态覆层）
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
  // 终端实例引用，用于在 useShellLogic 中访问 xterm.js 对象
  // 使用 MutableRefObject 因为 xterm.js 实例会在 Hook 内部被修改
  const terminal = useRef<ReturnType<typeof useTerminalSetup>['terminal']['current']>(null);

  // 使用自定义 Hook 管理所有 Shell 状态和逻辑
  // 该 Hook 封装了连接管理、终端初始化、自动重连等复杂逻辑
  const shellState = useShellLogic({
    selectedProject,
    selectedSession,
    initialCommand,
    isPlainShell,
    onProcessComplete,
    autoConnect,
    terminal
  });

  // 空状态：未选择项目时显示占位组件
  // 早期返回，避免渲染不必要的组件
  if (!selectedProject) {
    return <NoProjectSelected />;
  }

  // 最小化模式：不显示工具栏和状态覆层，仅显示终端本身
  // 适用于嵌入式场景或不需要 UI 控制的情况
  // 早期返回优化，减少条件判断
  if (minimal) {
    return <MinimalTerminal terminalRef={shellState.terminalRef} />;
  }

  // 完整模式：显示工具栏、终端和各种状态覆层
  // 将所有状态和回调函数通过 props 传递给子组件
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
 * 最小化终端组件
 * 仅显示 xterm.js 终端实例，无工具栏和状态覆层
 * 用于需要纯净终端体验的场景（如嵌入式视图、模态框等）
 */
interface MinimalTerminalProps {
  terminalRef: React.RefObject<HTMLDivElement>;
}

const MinimalTerminal: React.FC<MinimalTerminalProps> = ({ terminalRef }) => (
  <div className="h-full w-full bg-gray-900">
    {/* 终端容器 ref 用于 xterm.js 挂载 DOM 元素 */}
    {/* focus:outline-none 和 style={{ outline: 'none' }} 双重确保无焦点轮廓 */}
    <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />
  </div>
);

/**
 * 完整终端视图组件
 * 包含工具栏和所有状态覆层的完整终端界面
 * 这是最常用的终端展示模式，提供完整的用户交互功能
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
    {/* 终端工具栏：显示连接状态、会话信息和操作按钮 */}
    <TerminalToolbar
      isConnected={isConnected}
      isInitialized={isInitialized}
      isRestarting={isRestarting}
      selectedSession={selectedSession}
      onDisconnect={onDisconnect}
      onRestart={onRestart}
    />

    {/* 终端容器：包含 xterm.js 实例和状态覆层 */}
    <div className="flex-1 p-2 overflow-hidden relative">
      {/* xterm.js 终端实例挂载点 */}
      <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />

      {/* 初始化中状态覆层：xterm.js 实例创建时显示 */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-50">
          <div className="text-white">Loading terminal...</div>
        </div>
      )}

      {/* 连接提示覆层：终端已初始化但未连接时显示 */}
      {/* 仅在非连接状态下显示，提供用户主动连接的入口 */}
      {isInitialized && !isConnected && !isConnecting && (
        <ConnectPrompt
          onConnect={onConnect}
          isPlainShell={isPlainShell}
          initialCommand={initialCommand}
          displayName={selectedProject.displayName}
          sessionDisplayName={sessionDisplayNameLong}
        />
      )}

      {/* 连接中状态覆层：正在建立 WebSocket 连接时显示 */}
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
