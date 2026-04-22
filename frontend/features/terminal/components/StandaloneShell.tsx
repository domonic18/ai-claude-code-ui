import React, { useState, useCallback } from 'react';
import { default as Shell } from './Terminal';
import type { ShellProps } from '../types/terminal.types';

/**
 * 独立 Shell 包装器组件
 *
 * 这是一个通用的 Shell 包装组件，可以在多种上下文中使用：Tab、Modal、嵌入式视图等
 * 提供灵活的 API 支持：
 * - 独立使用模式（无会话）
 * - 会话恢复模式（基于 session ID）
 * - 自动检测 Shell 类型（Plain Shell vs Claude CLI）
 *
 * 支持的显示模式：
 * - 完整模式：带自定义标题、关闭按钮、完成状态指示器
 * - 最小化模式：无任何装饰元素，纯终端体验
 *
 * @param {Object} project - 项目对象，包含 name、fullPath/path、displayName
 * @param {Object} session - 会话对象（可选，用于 Tab 场景）
 * @param {string} command - 初始执行的命令（可选）
 * @param {boolean} isPlainShell - 使用普通 Shell 模式还是 Claude CLI（默认：自动检测）
 * @param {boolean} autoConnect - 挂载时是否自动连接（默认：true）
 * @param {function} onComplete - 进程完成时的回调（接收 exitCode）
 * @param {function} onClose - 关闭按钮的回调（可选）
 * @param {string} title - 自定义标题文本（可选）
 * @param {string} className - 额外的 CSS 类
 * @param {boolean} showHeader - 是否显示自定义标题栏（默认：true）
 * @param {boolean} compact - 使用紧凑布局（默认：false）
 * @param {boolean} minimal - 使用最小化模式：无标题、无覆层、自动连接（默认：false）
 */
interface StandaloneShellProps extends Omit<ShellProps, 'selectedProject' | 'selectedSession' | 'initialCommand'> {
  project?: {
    name: string;
    path: string;
    displayName?: string;
  } | null;
  session?: {
    id: string;
  } | null;
  command?: string | null;
  isPlainShell?: boolean | null;
  onComplete?: (exitCode: number) => void;
  onClose?: () => void;
  title?: string | null;
  showHeader?: boolean;
  compact?: boolean;
}

/**
 * 无项目占位组件
 * 当未提供项目时显示的友好提示界面
 */
function NoProjectPlaceholder({ className }: { className: string }) {
  return (
    <div className={`h-full flex items-center justify-center ${className}`}>
      <div className="text-center text-gray-500 dark:text-gray-400">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">No Project Selected</h3>
        <p>A project is required to open a shell</p>
      </div>
    </div>
  );
}

/**
 * 自定义标题栏组件
 * 显示 Shell 标题、完成状态指示器和关闭按钮
 * 提供比 TerminalToolbar 更轻量的 UI 控制
 */
function ShellHeader({ title, isCompleted, onClose }: { title: string; isCompleted: boolean; onClose?: () => void }) {
  return (
    <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium text-gray-200">{title}</h3>
          {isCompleted && (
            <span className="text-xs text-green-400">(Completed)</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// 默认属性配置
const STANDALONE_SHELL_DEFAULTS = {
  session: null, command: null, isPlainShell: null, autoConnect: true,
  onComplete: null, onClose: null, title: null, className: "",
  showHeader: true, compact: false, minimal: false
};

/**
 * 独立 Shell 主组件
 *
 * 该组件的核心功能是参数聚合和适配：
 * 1. 合并默认值和用户提供的 props
 * 2. 自动推断 Shell 类型（有 command 时用 Plain Shell，否则用 Claude CLI）
 * 3. 管理组件本地状态（完成状态）
 * 4. 转换项目/会话格式为 Shell 组件可接受的格式
 * 5. 条件渲染自定义标题栏
 *
 * 使用场景示例：
 * - Modal 中打开临时终端
 * - Tab 中持久化会话
 * - 内嵌到文档页面执行命令
 */
function StandaloneShell(rawProps: StandaloneShellProps) {
  const props = { ...STANDALONE_SHELL_DEFAULTS, ...rawProps };
  const {
    project, session, command, isPlainShell, autoConnect,
    onComplete, onClose, title, className, showHeader, minimal
  } = props;

  // 组件内部状态：跟踪进程是否完成
  const [isCompleted, setIsCompleted] = useState(false);

  // Shell 类型推断：如果明确指定了 isPlainShell 则使用该值，否则根据是否有 command 来推断
  const shouldUsePlainShell = isPlainShell !== null ? isPlainShell : (command !== null);

  // 标题栏显示条件：非最小化模式 + 启用了标题栏 + 有标题文本
  const shouldShowHeader = !minimal && showHeader && !!title;

  // 自动连接逻辑：最小化模式强制自动连接，否则使用用户指定的 autoConnect 值
  const effectiveAutoConnect = minimal || autoConnect;

  // 进程完成回调：更新内部状态并触发外部回调
  const handleProcessComplete = useCallback((exitCode: number) => {
    setIsCompleted(true);
    onComplete?.(exitCode);
  }, [onComplete]);

  // 空状态检查：项目是必需的，没有则显示占位组件
  if (!project) {
    return <NoProjectPlaceholder className={className} />;
  }

  // 主渲染逻辑：条件渲染标题栏 + Shell 组件
  return (
    <div className={`h-full w-full flex flex-col ${className}`}>
      {/* 根据条件显示自定义标题栏 */}
      {shouldShowHeader && <ShellHeader title={title} isCompleted={isCompleted} onClose={onClose} />}

      {/* Shell 组件容器，使用 flex-1 和 min-h-0 确保正确的高度约束 */}
      <div className="flex-1 w-full min-h-0">
        <Shell
          selectedProject={project}
          selectedSession={session}
          initialCommand={command}
          isPlainShell={shouldUsePlainShell}
          onProcessComplete={handleProcessComplete}
          minimal={minimal}
          autoConnect={effectiveAutoConnect}
        />
      </div>
    </div>
  );
}

export default StandaloneShell;