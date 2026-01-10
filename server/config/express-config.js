/**
 * Express 配置模块
 *
 * 使用中间件、路由和静态文件服务配置 Express 应用。
 *
 * @module config/express-config
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import mime from 'mime-types';

// 路由导入
import gitRoutes from '../routes/git.js';
import authRoutes from '../routes/auth.js';
import mcpRoutes from '../routes/mcp.js';
import cursorRoutes from '../routes/cursor.js';
import taskmasterRoutes from '../routes/taskmaster.js';
import mcpUtilsRoutes from '../routes/mcp-utils.js';
import commandsRoutes from '../routes/commands.js';
import settingsRoutes from '../routes/settings.js';
import agentRoutes from '../routes/agent.js';
import projectsRoutes from '../routes/projects.js';
import cliAuthRoutes from '../routes/cli-auth.js';
import userRoutes from '../routes/user.js';
import codexRoutes from '../routes/codex.js';
import filesRoutes from '../routes/files.js';
import sessionsRoutes from '../routes/sessions.js';
import uploadsRoutes from '../routes/uploads.js';
import systemRoutes from '../routes/system.js';

// 中间件导入
import { validateApiKey, authenticateToken } from '../middleware/auth.js';

/**
 * 使用中间件和路由配置 Express 应用
 * @param {express.Application} app - 要配置的 Express 应用
 * @param {WebSocketServer} wss - WebSocket 服务器（附加到 app.locals）
 */
export function configureExpress(app, wss) {
    // 使 WebSocket 服务器对路由可用
    app.locals.wss = wss;

    // CORS 中间件
    app.use(cors());

    // 带有自定义类型检查的 JSON 主体解析器
    app.use(express.json({
        limit: '50mb',
        type: (req) => {
            // 跳过 multipart/form-data 请求（用于文件上传，如图像）
            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('multipart/form-data')) {
                return false;
            }
            return contentType.includes('json');
        }
    }));

    // URL 编码解析器
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // 公共健康检查端点（无需身份验证）
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });

    // 可选的 API 密钥验证（如果已配置）
    app.use('/api', validateApiKey);

    // ===== 公共路由 =====
    app.use('/api/auth', authRoutes);

    // ===== 受保护的路由 =====
    app.use('/api/projects', authenticateToken, projectsRoutes);
    app.use('/api/git', authenticateToken, gitRoutes);
    app.use('/api/mcp', authenticateToken, mcpRoutes);
    app.use('/api/cursor', authenticateToken, cursorRoutes);
    app.use('/api/taskmaster', authenticateToken, taskmasterRoutes);
    app.use('/api/mcp-utils', authenticateToken, mcpUtilsRoutes);
    app.use('/api/commands', authenticateToken, commandsRoutes);
    app.use('/api/settings', authenticateToken, settingsRoutes);
    app.use('/api/cli', authenticateToken, cliAuthRoutes);
    app.use('/api/user', authenticateToken, userRoutes);
    app.use('/api/codex', authenticateToken, codexRoutes);
    app.use('/api/system', authenticateToken, systemRoutes);

    // ===== 特殊路由 =====
    // Agent API 路由（使用 API 密钥身份验证，不是令牌身份验证）
    app.use('/api/agent', agentRoutes);

    // 文件 API 路由（受保护）
    app.use('/api/projects', authenticateToken, filesRoutes);

    // 会话 API 路由（受保护）
    app.use('/api/projects', authenticateToken, sessionsRoutes);

    // 上传 API 路由（受保护）
    app.use('/api', authenticateToken, uploadsRoutes);

    // ===== 静态文件 =====
    // 提供公共文件（如 api-docs.html）
    app.use(express.static(path.join(process.cwd(), 'server', '../public')));

    // 在 API 路由之后提供静态文件
    // 添加缓存控制：HTML 文件不应被缓存，但资产可以被缓存
    app.use(express.static(path.join(process.cwd(), 'server', '../dist'), {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                // 防止 HTML 缓存以避免构建后的 Service Worker 问题
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            } else if (filePath.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
                // 缓存静态资产 1 年（它们具有哈希名称）
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        }
    }));

    // ===== SPA 回退 =====
    // 为所有其他路由提供 React 应用（不包括静态文件）
    app.get('*', (req, res) => {
        // 跳过静态资产的请求（带有扩展名的文件）
        if (path.extname(req.path)) {
            return res.status(404).send('Not found');
        }

        // 仅对 HTML 路由提供 index.html，不对静态资产提供
        const indexPath = path.join(process.cwd(), 'server', '../dist/index.html');

        // 检查 dist/index.html 是否存在（生产构建可用）
        if (require('fs').existsSync(indexPath)) {
            // 为 HTML 设置无缓存头以防止 Service Worker 问题
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.sendFile(indexPath);
        } else {
            // 在开发环境中，仅当 dist 不存在时重定向到 Vite 开发服务器
            res.redirect(`http://localhost:${process.env.VITE_PORT || 5173}`);
        }
    });
}
