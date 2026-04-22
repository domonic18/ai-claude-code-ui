/**
 * useTerminalSetup Hook
 *
 * Custom hook for initializing and configuring xterm.js Terminal instances.
 * Handles addon loading, keyboard events, resize observation, and cleanup.
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
 */
export interface TerminalSetup {
  /** Ref to the terminal container div */
  terminalRef: React.RefObject<HTMLDivElement>;
  /** Ref to the Terminal instance */
  terminal: React.MutableRefObject<Terminal | null>;
  /** Ref to the FitAddon instance */
  fitAddon: React.MutableRefObject<FitAddon | null>;
  /** Whether the terminal is initialized */
  isInitialized: boolean;
}

interface UseTerminalSetupOptions {
  /** Dependency to trigger re-initialization */
  initKey: string;
  /** Whether the terminal is restarting */
  isRestarting: boolean;
  /** Callback for terminal data input */
  onInput?: (data: string) => void;
  /** Callback for terminal resize */
  onResize?: (cols: number, rows: number) => void;
  /** Whether auto-connect is enabled */
  autoConnect: boolean;
  /** Called when initialization completes */
  onInitialized: () => void;
  /** Send function from connection hook */
  send: (data: object) => void;
}

/**
 * Create and configure terminal instance with addons
 */
function createTerminalInstance(
  terminalRef: React.RefObject<HTMLDivElement>,
  send: (data: object) => void,
  onResize?: (cols: number, rows: number) => void,
  onInput?: (data: string) => void
): { terminal: Terminal; fitAddon: FitAddon; resizeObserver: ResizeObserver } {
  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    allowProposedApi: true,
    allowTransparency: false,
    convertEol: true,
    scrollback: 10000,
    tabStopWidth: 4,
    windowsMode: false,
    macOptionIsMeta: true,
    macOptionClickForcesSelection: false,
    theme: {
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

  const fitAddon = new FitAddon();
  const webglAddon = new WebglAddon();
  const webLinksAddon = new WebLinksAddon();

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);

  try {
    terminal.loadAddon(webglAddon);
  } catch {
    logger.warn('[Shell] WebGL renderer unavailable, using Canvas fallback');
  }

  terminal.open(terminalRef.current!);

  // 自定义键盘处理
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

  if (terminalRef.current) {
    resizeObserver.observe(terminalRef.current);
  }

  return { terminal, fitAddon, resizeObserver };
}

// 由组件调用，自定义 Hook：useTerminalSetup
/**
 * Custom hook for terminal instance setup and lifecycle management
 */
export function useTerminalSetup(options: UseTerminalSetupOptions): TerminalSetup {
  const {
    initKey,
    isRestarting,
    onInput,
    onResize,
    onInitialized,
    send,
  } = options;

  const terminalRef = useRef<HTMLDivElement>(null!);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // 防止重复初始化
    if (!terminalRef.current || !initKey || isRestarting || terminal.current) {
      return;
    }

    const { terminal: termInstance, fitAddon: fitInstance, resizeObserver } = createTerminalInstance(
      terminalRef,
      send,
      onResize,
      onInput
    );

    terminal.current = termInstance;
    fitAddon.current = fitInstance;
    isInitializedRef.current = true;
    onInitialized();

    // 清理函数：组件卸载或依赖变化时执行
    return () => {
      resizeObserver.disconnect();

      if (terminal.current) {
        terminal.current.dispose();
        terminal.current = null;
      }
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
