/**
 * Shell WebSocket 常量
 *
 * 定义 shell/终端处理相关的常量
 *
 * @module websocket/handlers/shell-constants
 */

/**
 * PTY 会话超时时间（毫秒）
 *
 * 当客户端断开连接后，PTY 会话会在此时间后被清理
 * 默认 30 分钟
 */
export const PTY_SESSION_TIMEOUT = 30 * 60 * 1000;
