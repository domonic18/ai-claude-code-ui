/**
 * useTerminalSetup Hook
 *
 * Custom hook for initializing and configuring xterm.js Terminal instances.
 * Handles addon loading, keyboard events, resize observation, and cleanup.
 * 自定义 Hook，用于初始化和配置 xterm.js 终端实例
 */

// 导入 React Hooks
import { useEffect, useRef } from 'react';
// 导入 xterm.js 核心库
import { Terminal } from '@xterm/xterm';
// 导入 xterm.js 插件
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
// 导入日志工具
import { logger } from '@/shared/utils/logger';

// TerminalSetup 的类型定义
/**
 * Hook return type
 * Hook 返回类型，包含终端实例和相关引用
 */
export interface TerminalSetup {
  /** Ref to the terminal container div - 终端容器的 DOM 引用 */
  terminalRef: React.RefObject<HTMLDivElement>;
  /** Ref to the Terminal instance - 终端实例的引用 */
  terminal: React.MutableRefObject<Terminal | null>;
  /** Ref to the FitAddon instance - FitAddon 插件的引用 */
  fitAddon: React.MutableRefObject<FitAddon | null>;
  /** Whether the terminal is initialized - 终端是否已初始化 */
  isInitialized: boolean;
}

interface UseTerminalSetupOptions {
  /** Dependency to trigger re-initialization - 触发重新初始化的依赖项 */
  initKey: string;
  /** Whether the terminal is restarting - 终端是否正在重启 */
  isRestarting: boolean;
  /** Callback for terminal data input - 终端数据输入的回调 */
  onInput?: (data: string) => void;
  /** Callback for terminal resize - 终端尺寸变化的回调 */
  onResize?: (cols: number, rows: number) => void;
  /** Whether auto-connect is enabled - 是否启用自动连接 */
  autoConnect: boolean;
  /** Called when initialization completes - 初始化完成时的回调 */
  onInitialized: () => void;
  /** Send function from connection hook - 来自连接 Hook 的发送函数 */
  send: (data: object) => void;
}

/**
 * Create and configure terminal instance with addons
 * 创建并配置终端实例，加载所有必需的插件
 */
function createTerminalInstance(
  terminalRef: React.RefObject<HTMLDivElement>,
  send: (data: object) => void,
  onResize?: (cols: number, rows: number) => void,
  onInput?: (data: string) => void
): { terminal: Terminal; fitAddon: FitAddon; resizeObserver: ResizeObserver } {
  // 创建 xterm.js 终端实例，配置主题和选项
  const terminal = new Terminal({
    cursorBlink: true,                                    // 光标闪烁
    fontSize: 14,                                         // 字体大小
    fontFamily: 'Menlo, Monaco, "Courier New", monospace', // 字体家族
    allowProposedApi: true,                               // 允许使用实验性 API
    allowTransparency: false,                             // 禁用透明背景
    convertEol: true,                                     // 自动转换行尾符
    scrollback: 10000,                                    // 滚动缓冲区大小
    tabStopWidth: 4,                                      // Tab 宽度
    windowsMode: false,                                   // 非 Windows 模式
    macOptionIsMeta: true,                                // Mac 上 Option 键作为 Meta 键
    macOptionClickForcesSelection: false,                 // Mac 上 Option+点击不强制选择
    theme: {                                              // 终端主题颜色
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      cursorAccent: '#1e1e1e',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff'
    } as any
  });

  // 创建 xterm.js 插件实例
  const fitAddon = new FitAddon();      // 自适应尺寸插件
  const webglAddon = new WebglAddon();  // WebGL 渲染插件
  const webLinksAddon = new WebLinksAddon(); // 链接点击插件

  // 加载必需的插件
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);

  // 尝试加载 WebGL 渲染器，失败时使用 Canvas 回退
  try {
    terminal.loadAddon(webglAddon);
  } catch {
    logger.warn('[Shell] WebGL renderer unavailable, using Canvas fallback');
  }

  // 将终端挂载到 DOM 元素
  terminal.open(terminalRef.current!);

  // 自定义键盘处理
  // 拦截键盘事件，实现复制粘贴等快捷键
  terminal.attachCustomKeyEventHandler((event) => {
    // Ctrl/Cmd + C 复制选中文本
    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.hasSelection()) {
      document.execCommand('copy');
      return false;
    }

    // Ctrl/Cmd + V 粘贴剪贴板内容
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      navigator.clipboard.readText().then(text => {
        send({ type: 'input', data: text });
      }).catch(() => {});
      return false;
    }

    return true;
  });

  // 初始适配：延迟执行以确保 DOM 完全渲染
  setTimeout(() => {
    fitAddon.fit();
    onResize?.(terminal.cols, terminal.rows);
  }, 100);

  // 数据输入处理器：用户输入时触发
  terminal.onData((data) => {
    onInput?.(data);
  });

  // 尺寸观察器：监听容器尺寸变化
  const resizeObserver = new ResizeObserver(() => {
    setTimeout(() => {
      fitAddon.fit();
      onResize?.(terminal.cols, terminal.rows);
    }, 50);
  });

  // 开始观察容器尺寸变化
  if (terminalRef.current) {
    resizeObserver.observe(terminalRef.current);
  }

  return { terminal, fitAddon, resizeObserver };
}

// 由组件调用，自定义 Hook：useTerminalSetup
/**
 * Custom hook for terminal instance setup and lifecycle management
 * 终端实例设置和生命周期管理的自定义 Hook
 */
export function useTerminalSetup(options: UseTerminalSetupOptions): TerminalSetup {
  // 解构出所有选项
  const {
    initKey,           // 初始化键值（变化时触发重新初始化）
    isRestarting,      // 是否正在重启
    onInput,           // 输入回调
    onResize,          // 尺寸调整回调
    onInitialized,     // 初始化完成回调
    send,              // WebSocket 发送函数
  } = options;

  // 终端容器的 DOM 引用
  const terminalRef = useRef<HTMLDivElement>(null!);
  // 终端实例的引用
  const terminal = useRef<Terminal | null>(null);
  // FitAddon 插件的引用
  const fitAddon = useRef<FitAddon | null>(null);
  // 初始化状态的引用
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // 防止重复初始化
    // 检查所有必需条件：容器存在、有 initKey、非重启状态、终端未创建
    if (!terminalRef.current || !initKey || isRestarting || terminal.current) {
      return;
    }

    // 创建终端实例并加载插件
    const { terminal: termInstance, fitAddon: fitInstance, resizeObserver } = createTerminalInstance(
      terminalRef,
      send,
      onResize,
      onInput
    );

    // 保存实例到 ref
    terminal.current = termInstance;
    fitAddon.current = fitInstance;
    isInitializedRef.current = true;
    // 触发初始化完成回调
    onInitialized();

    // 清理函数：组件卸载或依赖变化时执行
    return () => {
      // 停止观察尺寸变化
      resizeObserver.disconnect();

      // 销毁终端实例
      if (terminal.current) {
        terminal.current.dispose();
        terminal.current = null;
      }
      // 清理插件引用
      fitAddon.current = null;
      isInitializedRef.current = false;
    };
  }, [initKey, isRestarting, send, onResize, onInput, onInitialized]);

  return {
    terminalRef,
    terminal,
    fitAddon,
    isInitialized: isInitializedRef.current,
  };
}
