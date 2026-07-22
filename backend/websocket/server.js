/**
 * WebSocket 服务器模块
 *
 * 管理 WebSocket 服务器初始化、身份验证和
 * 基于 URL 路径的连接路由。
 *
 * @module backend/websocket/server
 */

import { WebSocketServer } from 'ws';
import { authenticateWebSocket } from '../middleware/auth.js';
import { handleChatConnection } from './handlers/chat.js';
import { handleShellConnection } from './handlers/shell.js';
import { SERVER, WEBSOCKET } from '../config/config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('websocket/server');

// WebSocket 消息或事件处理
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
            logger.debug('WebSocket connection attempt to:', info.req.url);

            // 平台模式：始终允许连接
            if (SERVER.isPlatform) {
                const user = authenticateWebSocket(null); // 将返回第一个用户
                if (!user) {
                    logger.warn('[WARN] Platform mode: No user found in database');
                    return false;
                }
                info.req.user = user;
                logger.info('[OK] Platform mode WebSocket authenticated for user:', user.username);
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
                logger.warn('[WARN] WebSocket authentication failed');
                return false;
            }

            // 在请求中存储用户信息供后续使用
            info.req.user = user;
            logger.info('[OK] WebSocket authenticated for user:', user.username);
            return true;
        }
    });

    // 基于 URL 路径设置连接路由
    wss.on('connection', (ws, request) => {
        const url = request.url;
        logger.info('[INFO] Client connected to:', url);

        // 将用户信息从请求传递到 WebSocket 对象
        ws.user = request.user;

        // 心跳初始化：收到客户端回的协议层 pong 帧即视为连接存活。
        // 浏览器原生 WebSocket 会自动回复协议层 pong，前端无需任何代码。
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        // 解析 URL 以获取不带查询参数的路径名
        const urlObj = new URL(url, 'http://localhost');
        const pathname = urlObj.pathname;

        if (pathname === '/shell') {
            handleShellConnection(ws, ptySessionsMap);
        } else if (pathname === '/ws') {
            handleChatConnection(ws, connectedClients);
        } else {
            logger.warn('[WARN] Unknown WebSocket path:', pathname);
            ws.close();
        }
    });

    // ─── 心跳保活 ─────────────────────────────────────────
    // 目的：防止连接因长时间无数据流（idle）被中间链路（nginx/LB/NAT）
    // 的 idle 超时静默掐断——这正是"用户很久没动就掉线、消息发了收不到回复"的根因。
    // 协议层 ping/pong 是真实数据帧，会刷新链路上所有中间设备的 idle 计时器；
    // 且不触发应用层 onmessage，不影响容器"两小时不活跃销毁"判定（仅业务执行才更新 container.lastActive）。
    // 复用此前定义但未启用的 WEBSOCKET.heartbeatInterval（默认 30s，需短于 nginx 默认 60s idle）。
    const heartbeatMs = WEBSOCKET.heartbeatInterval > 0 ? WEBSOCKET.heartbeatInterval : 30000;

    const heartbeatTimer = setInterval(() => {
        wss.clients.forEach((ws) => {
            // 上一轮 ping 后未收到 pong → 判定为僵死连接（半开/idle 已断），强制终止。
            // terminate 会触发前端 onclose，进而走前端的自动重连逻辑。
            if (ws.isAlive === false) {
                logger.warn(
                    { userId: ws.user?.userId, username: ws.user?.username },
                    'WebSocket pingpong 超时，终止连接'
                );
                ws.terminate();
                return;
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, heartbeatMs);
    // 保留 timer 引用，便于必要时清理（进程退出时 Node 会自动回收该 timer）
    wss._heartbeatTimer = heartbeatTimer;

    logger.info({ heartbeatMs }, '[OK] WebSocket 心跳已启用');

    return wss;
}

