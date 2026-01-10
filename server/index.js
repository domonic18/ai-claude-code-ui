#!/usr/bin/env node
/**
 * Claude Code UI 服务器 - 主入口点
 *
 * 初始化并启动带 WebSocket 支持的 Express 服务器。
 *
 * @module server/index
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';

// 配置模块
import { loadEnvironment, c } from './config/environment.js';
import { configureExpress } from './config/express-config.js';
import { createWebSocketServer } from './websocket/server.js';

// 数据库和服务
import { initializeDatabase } from './database/db.js';
import { setupProjectsWatcher } from './utils/project-watcher.js';

// 加载环境变量和配置
loadEnvironment();

// 已连接的 WebSocket 客户端，用于项目更新
const connectedClients = new Set();

// PTY 会话映射，用于 shell 终端管理
const ptySessionsMap = new Map();

// 服务器配置
const PORT = process.env.PORT || 3001;

// 初始化 Express 应用和 HTTP 服务器
const app = express();
const server = http.createServer(app);

// 创建并配置 WebSocket 服务器
const wss = createWebSocketServer(server, connectedClients, ptySessionsMap);

// 使用中间件和路由配置 Express
configureExpress(app, wss);

/**
 * 启动服务器
 */
async function startServer() {
    try {
        // 初始化身份验证数据库
        await initializeDatabase();

        // 检查是否在生产模式下运行（dist 文件夹存在）
        const distIndexPath = path.join(process.cwd(), 'dist/index.html');
        const isProduction = fs.existsSync(distIndexPath);

        // 记录 Claude 实现模式
        console.log(`${c.info('[INFO]')} Using Claude Agents SDK for Claude integration`);
        console.log(`${c.info('[INFO]')} Running in ${c.bright(isProduction ? 'PRODUCTION' : 'DEVELOPMENT')} mode`);

        if (!isProduction) {
            console.log(`${c.warn('[WARN]')} Note: Requests will be proxied to Vite dev server at ${c.dim('http://localhost:' + (process.env.VITE_PORT || 5173))}`);
        }

        server.listen(PORT, '0.0.0.0', async () => {
            const appInstallPath = path.join(process.cwd());

            console.log('');
            console.log(c.dim('═'.repeat(63)));
            console.log(`  ${c.bright('Claude Code UI Server - Ready')}`);
            console.log(c.dim('═'.repeat(63)));
            console.log('');
            console.log(`${c.info('[INFO]')} Server URL:  ${c.bright('http://0.0.0.0:' + PORT)}`);
            console.log(`${c.info('[INFO]')} Installed at: ${c.dim(appInstallPath)}`);
            console.log(`${c.tip('[TIP]')}  Run "cloudcli status" for full configuration details`);
            console.log('');

            // 开始监控项目文件夹的更改
            await setupProjectsWatcher(connectedClients);
        });
    } catch (error) {
        console.error('[ERROR] Failed to start server:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();
