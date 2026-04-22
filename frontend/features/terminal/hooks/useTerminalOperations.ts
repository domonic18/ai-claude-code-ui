/**
 * Terminal Operations
 *
 * 终端操作函数模块
 *
 * 该模块提供了通过 WebSocket 执行终端操作的完整功能集：
 * 1. 添加输出记录（带唯一 ID 和时间戳）
 * 2. 执行命令（发送到 WebSocket）
 * 3. 写入输入（模拟用户键盘输入）
 * 4. 调整终端尺寸（通知后端 PTY 尺寸变化）
 * 5. 终止进程（发送信号）
 *
 * 这些函数从 useTerminal.ts 提取出来以降低复杂度，提高代码可维护性
 *
 * @module features/terminal/hooks/useTerminalOperations
 */

// 导入 useCallback Hook 用于优化回调函数性能
import { useCallback } from 'react';
// 导入终端进程和输出类型定义
import type { TerminalProcess, TerminalOutput } from '../types';
// 导入日志工具用于错误记录
import { logger } from '@/shared/utils/logger';

/**
 * 生成唯一的输出 ID
 * 使用时间戳和随机字符串组合，确保 ID 的唯一性
 * @returns 唯一 ID 字符串，格式为 "output-{timestamp}-{random}"
 */
function generateOutputId(): string {
  return `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 添加输出到状态
 *
 * 该函数用于将终端输出添加到状态管理中：
 * 1. 生成唯一的输出 ID
 * 2. 添加当前时间戳
 * 3. 检查组件是否已挂载（避免内存泄漏）
 * 4. 更新状态并触发回调
 *
 * @param output - 不包含 id 和 timestamp 的输出数据
 * @param isMountedRef - 跟踪组件挂载状态的 ref
 * @param setOutputs - 输出状态的 setter 函数
 * @param onOutput - 可选的输出添加回调函数
 */
export function addOutput(
  output: Omit<TerminalOutput, 'id' | 'timestamp'>,
  isMountedRef: React.RefObject<boolean>,
  setOutputs: React.Dispatch<React.SetStateAction<TerminalOutput[]>>,
  onOutput?: (output: TerminalOutput) => void
): void {
  // 构建完整的输出对象
  const newOutput: TerminalOutput = {
    id: generateOutputId(),
    timestamp: new Date(),
    ...output,
  };

  // 仅在组件已挂载时更新状态，避免内存泄漏
  // 这是 React 组件卸载后的状态更新防护模式
  if (isMountedRef.current) {
    setOutputs(prev => [...prev, newOutput]);
    onOutput?.(newOutput);
  }
}

/**
 * 通过 WebSocket 执行命令
 *
 * 该函数用于在远程终端中执行命令：
 * 1. 验证 WebSocket 连接状态
 * 2. 创建进程对象并更新状态
 * 3. 通过 WebSocket 发送命令和参数
 * 4. 处理错误情况
 *
 * @param wsRef - WebSocket 实例的 ref
 * @param isConnected - 连接状态标志
 * @param command - 要执行的命令名称
 * @param args - 命令参数数组
 * @param cwd - 工作目录路径
 * @param env - 环境变量对象
 * @param process - 当前进程对象
 * @param setProcess - 进程状态的 setter
 * @param setIsLoading - 加载状态的 setter
 * @param setError - 错误状态的 setter
 * @param onError - 可选的错误回调函数
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
  // 检查 WebSocket 连接是否有效
  // 早期返回避免无效操作
  if (!wsRef.current || !isConnected) {
    const error = new Error('Terminal not connected');
    setError(error);
    onError?.(error);
    throw error;
  }

  // 更新加载状态和错误状态
  setIsLoading(true);
  setError(null);

  // 创建新的进程对象
  const newProcess: TerminalProcess = {
    id: `process-${Date.now()}`,
    command,
    args,
    status: 'running',
    cwd: cwd || process?.cwd,
    env: env || process?.env,
  };

  setProcess(newProcess);

  // 通过 WebSocket 发送命令执行请求
  // 使用 try-catch 捕获网络错误
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
 * 向终端发送输入
 *
 * 该函数模拟用户在终端中的键盘输入：
 * - 将输入字符串通过 WebSocket 发送到后端
 * - 后端将输入注入到 PTY（伪终端）
 * - 适用于自动化测试或程序化交互场景
 *
 * @param wsRef - WebSocket 实例的 ref
 * @param isConnected - 连接状态标志
 * @param input - 要发送的输入字符串
 */
export function writeInputToWebSocket(
  wsRef: React.RefObject<WebSocket>,
  isConnected: boolean,
  input: string
): void {
  // 静默失败：如果未连接则不执行操作
  // 这种设计避免了在每个调用点都进行连接状态检查
  if (!wsRef.current || !isConnected) {
    return;
  }

  // 发送输入数据到后端 PTY
  // 错误被记录但不会抛出异常，保持接口简单
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
 * 调整终端尺寸
 *
 * 该函数在终端容器尺寸变化时调用：
 * - 通知后端 PTY（伪终端）的行数和列数变化
 * - 确保终端程序正确响应尺寸变化（如重绘界面）
 * - 由 xterm.js 的 resize 事件触发
 *
 * @param wsRef - WebSocket 实例的 ref
 * @param isConnected - 连接状态标志
 * @param cols - 终端列数（字符宽度）
 * @param rows - 终端行数（字符高度）
 */
export function resizeTerminalWebSocket(
  wsRef: React.RefObject<WebSocket>,
  isConnected: boolean,
  cols: number,
  rows: number
): void {
  // 静默失败：如果未连接则不执行操作
  // 避免在窗口调整大小时产生大量错误日志
  if (!wsRef.current || !isConnected) {
    return;
  }

  // 发送尺寸调整请求到后端
  // 后端需要调整 PTY 的窗口大小以正确渲染输出
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
 * 终止进程
 *
 * 该函数用于终止当前运行的终端进程：
 * - 发送 SIGTERM 信号到后端
 * - 后端将信号转发给 PTY 中的进程组
 * - 适用于强制退出卡死的程序或优雅关闭进程
 *
 * @param wsRef - WebSocket 实例的 ref
 * @param isConnected - 连接状态标志
 */
export function killProcessViaWebSocket(
  wsRef: React.RefObject<WebSocket>,
  isConnected: boolean
): void {
  // 静默失败：如果未连接则不执行操作
  if (!wsRef.current || !isConnected) {
    return;
  }

  // 发送 SIGTERM 信号到后端
  // 后端将信号转发给 PTY 中的进程组
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
 * 创建终端操作集合
 *
 * 这是一个工厂函数，用于创建所有终端操作的高阶函数：
 * 1. 封装 WebSocket 状态检查
 * 2. 封装状态更新逻辑
 * 3. 提供 useCallback 优化的回调函数
 * 4. 统一错误处理
 *
 * 返回的对象可以直接传递给组件使用
 *
 * @param wsRef - WebSocket 实例的 ref
 * @param isConnected - 连接状态标志
 * @param process - 当前进程对象
 * @param args - 默认命令参数
 * @param cwd - 默认工作目录
 * @param env - 默认环境变量
 * @param setProcess - 进程状态的 setter
 * @param setIsLoading - 加载状态的 setter
 * @param setError - 错误状态的 setter
 * @param setOutputs - 输出状态的 setter
 * @param isMountedRef - 组件挂载状态的 ref
 * @param onError - 可选的错误回调函数
 * @param onOutput - 可选的输出回调函数
 * @returns 包含所有终端操作方法的对象
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
  // 创建添加输出的回调函数
  // 使用 useCallback 优化性能，避免不必要的重新渲染
  const addOutputCallback = useCallback((output: Omit<TerminalOutput, 'id' | 'timestamp'>) => {
    addOutput(output, isMountedRef, setOutputs, onOutput);
  }, [onOutput]);

  // 创建执行命令的回调函数
  // 允许覆盖默认参数，提供灵活性
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

  // 创建写入输入的回调函数
  // 用于模拟用户在终端中的键盘输入
  const writeInputCallback = useCallback((input: string) => {
    writeInputToWebSocket(wsRef, isConnected, input);
  }, [isConnected]);

  // 创建调整终端尺寸的回调函数
  // 由 xterm.js 的 resize 事件触发
  const resizeTerminalCallback = useCallback((cols: number, rows: number) => {
    resizeTerminalWebSocket(wsRef, isConnected, cols, rows);
  }, [isConnected]);

  // 创建终止进程的回调函数
  // 发送 SIGTERM 信号到后端
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
