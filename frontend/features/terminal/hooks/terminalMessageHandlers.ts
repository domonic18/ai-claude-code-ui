/**
 * Terminal Message Handlers
 *
 * 终端 WebSocket 消息处理模块
 *
 * 该模块提供了终端与后端 WebSocket 通信的核心消息处理逻辑：
 * 1. 解析终端输出中的进程退出码
 * 2. 创建 WebSocket 消息处理器（处理 output、url_open 等消息类型）
 * 3. 配置 WebSocket 连接的 onopen 回调
 * 4. 配置 WebSocket 完整的事件处理器集合
 *
 * @module features/terminal/hooks/terminalMessageHandlers
 */

import { logger } from '@/shared/utils/logger';
import { buildInitMessage } from '../utils/webSocketFactory';

/**
 * 从终端输出中提取进程退出码
 *
 * 该函数用于检测 Plain Shell 模式下的进程完成状态：
 * 1. 移除 ANSI 转义码（颜色、样式等）
 * 2. 查找 "Process exited with code" 模式
 * 3. 提取并返回退出码（0 表示成功）
 *
 * @param output - 原始终端输出文本，可能包含 ANSI 转义码
 * @returns 退出码数字，如果未检测到退出则返回 null
 */
export function extractExitCode(output: string): number | null {
  // 移除 ANSI 颜色和样式转义码，保留纯文本以便匹配
  const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');

  // 快速检查退出码 0（最常见的情况）
  if (cleanOutput.includes('Process exited with code 0')) return 0;

  // 使用正则表达式提取任意退出码
  const match = cleanOutput.match(/Process exited with code (\d+)/);
  const code = match ? parseInt(match[1]) : null;

  // 仅返回非零退出码（0 已经在上面处理过）
  return code !== null && code !== 0 ? code : null;
}

/**
 * 创建 WebSocket 消息处理器
 *
 * 该处理器是 WebSocket onmessage 事件的回调函数，负责：
 * 1. 解析 JSON 格式的消息
 * 2. 根据消息类型分发到不同的处理逻辑：
 *    - output: 将终端输出写入 xterm.js 实例，并检测进程退出
 *    - url_open: 在新标签页打开 URL
 * 3. 错误处理和日志记录
 *
 * @param isPlainShellRef - Plain Shell 模式的引用（用于决定是否检测退出码）
 * @param onProcessCompleteRef - 进程完成回调的引用
 * @param onOutput - 终端输出回调函数（可选）
 * @param onUrlOpen - URL 打开回调函数（可选）
 * @returns WebSocket 消息事件处理函数
 */
export function createWebSocketMessageHandler(
  isPlainShellRef: React.MutableRefObject<boolean>,
  onProcessCompleteRef: React.MutableRefObject<((code: number) => void) | undefined>,
  onOutput?: (output: string) => void,
  onUrlOpen?: (url: string) => void
) {
  return (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // 处理终端输出消息
      if (data.type === 'output') {
        const output = data.data;

        // Plain Shell 模式下检测进程退出
        if (isPlainShellRef.current && onProcessCompleteRef.current) {
          const exitCode = extractExitCode(output);
          if (exitCode !== null) onProcessCompleteRef.current(exitCode);
        }

        // 将输出写入终端
        onOutput?.(output);
      } else if (data.type === 'url_open') {
        // 处理 URL 打开请求（某些 CLI 工具会触发）
        onUrlOpen?.(data.url);
      }
    } catch (error) {
      logger.error('[Shell] Error handling WebSocket message:', error, event.data);
    }
  };
}

/**
 * 配置 WebSocket onopen 处理器
 *
 * 该函数在 WebSocket 连接成功建立后被调用：
 * 1. 更新连接状态（isConnected、isConnecting）
 * 2. 等待 100ms 确保 xterm.js 实例完全初始化
 * 3. 调用 fitAddon.fit() 使终端尺寸适应容器
 * 4. 构建并发送初始化消息（包含项目路径、会话 ID、终端尺寸等）
 *
 * 延迟发送初始化消息是为了避免在 xterm.js 未就绪时发送数据导致的问题
 *
 * @param ws - WebSocket 实例
 * @param params - 连接参数对象，包含所有需要的 refs 和状态 setters
 */
export function configureWebSocketOnOpen(
  ws: WebSocket,
  params: WebSocketConnectionParams
) {
  ws.onopen = () => {
    // 更新连接状态
    params.setIsConnected(true);
    params.setIsConnecting(false);
    params.isConnectingRef.current = false;

    // 延迟 100ms 后发送初始化消息，确保终端实例已完全就绪
    setTimeout(() => {
      if (params.fitAddonRef.current && params.terminalRef.current && ws) {
        // 调整终端尺寸以适应容器
        params.fitAddonRef.current.fit();

        // 构建初始化消息（包含项目路径、会话信息、终端尺寸等）
        const initMessage = buildInitMessage({
          selectedProjectRef: params.selectedProjectRef,
          selectedSessionRef: params.selectedSessionRef,
          initialCommandRef: params.initialCommandRef,
          isPlainShellRef: params.isPlainShellRef,
          terminalRef: params.terminalRef
        });

        // 发送初始化消息到后端
        ws.send(JSON.stringify(initMessage));
      }
    }, 100);
  };
}

/**
 * 配置完整的 WebSocket 事件处理器集合
 *
 * 该函数是 WebSocket 配置的一站式入口，设置所有必需的事件监听器：
 * - onopen: 连接建立后的初始化逻辑
 * - onmessage: 接收后端消息的处理逻辑
 * - onclose: 连接关闭后的状态更新
 * - onerror: 连接错误的状态更新
 *
 * 使用该函数确保 WebSocket 生命周期与 React 状态正确同步
 *
 * @param ws - WebSocket 实例
 * @param params - 连接参数对象
 */
export function configureWebSocketHandlers(
  ws: WebSocket,
  params: WebSocketConnectionParams
) {
  // 配置 onopen 处理器
  configureWebSocketOnOpen(ws, params);

  // 配置 onmessage 处理器（处理输出、URL 打开等消息）
  ws.onmessage = createWebSocketMessageHandler(
    params.isPlainShellRef,
    params.onProcessCompleteRef,
    params.onOutput,
    params.onUrlOpen
  );

  // 配置 onclose 处理器（更新连接状态）
  ws.onclose = () => {
    params.setIsConnected(false);
    params.setIsConnecting(false);
    params.isConnectingRef.current = false;
  };

  // 配置 onerror 处理器（更新连接状态）
  ws.onerror = () => {
    params.setIsConnected(false);
    params.setIsConnecting(false);
    params.isConnectingRef.current = false;
  };
}
