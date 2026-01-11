/**
 * WebSocket 服务器模块
 *
 * 管理 WebSocket 服务器初始化、身份验证和
 * 基于 URL 路径的连接路由。
 *
 * @module websocket/server
 */

import { WebSocketServer } from 'ws';
import { authenticateWebSocket } from '../middleware/auth.js';
import { handleChatConnection } from './handlers/chat.js';
import { handleShellConnection } from './handlers/shell.js';

/**
 * 创建并配置 WebSocket 服务器
 * @param {http.Server} server - 要附加 WebSocket 的 HTTP 服务器
 * @param {Set} connectedClients - 已连接客户端的集合，用于项目更新
 * @param {Map} ptySessionsMap - 用于管理 PTY 会话的映射
 * @returns {WebSocketServer} 配置好的 WebSocket 服务器
 */
export function createWebSocketServer(server, connectedClients, ptySessionsMap) {
    // 创建带身份验证的 WebSocket 服务器
    const wss = new WebSocketServer({
        server,
        verifyClient: (info) => {
            console.log('WebSocket connection attempt to:', info.req.url);

            // 平台模式：始终允许连接
            if (process.env.VITE_IS_PLATFORM === 'true') {
                const user = authenticateWebSocket(null); // 将返回第一个用户
                if (!user) {
                    console.log('[WARN] Platform mode: No user found in database');
                    return false;
                }
                info.req.user = user;
                console.log('[OK] Platform mode WebSocket authenticated for user:', user.username);
                return true;
            }

            // 普通模式：验证令牌
            // 从查询参数或请求头中提取令牌
            const url = new URL(info.req.url, 'http://localhost');
            const token = url.searchParams.get('token') ||
                info.req.headers.authorization?.split(' ')[1];

            // 验证令牌
            const user = authenticateWebSocket(token);
            if (!user) {
                console.log('[WARN] WebSocket authentication failed');
                return false;
            }

            // 在请求中存储用户信息供后续使用
            info.req.user = user;
            console.log('[OK] WebSocket authenticated for user:', user.username);
            return true;
        }
    });

    // 基于 URL 路径设置连接路由
    wss.on('connection', (ws, request) => {
        const url = request.url;
        console.log('[INFO] Client connected to:', url);

        // 将用户信息从请求传递到 WebSocket 对象
        ws.user = request.user;

        // 解析 URL 以获取不带查询参数的路径名
        const urlObj = new URL(url, 'http://localhost');
        const pathname = urlObj.pathname;

        if (pathname === '/shell') {
            handleShellConnection(ws, ptySessionsMap);
        } else if (pathname === '/ws') {
            handleChatConnection(ws, connectedClients);
        } else {
            console.log('[WARN] Unknown WebSocket path:', pathname);
            ws.close();
        }
    });

    return wss;
}
