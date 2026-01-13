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
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { FILES, SERVER } from './config.js';

// 路由导入 - 新结构（按功能分组）
import { auth, settings, users } from '../routes/core/index.js';
import { projects, sessions, files, git } from '../routes/resources/index.js';
import { claude, cursor, codex, mcp, taskmaster, agent } from '../routes/integrations/index.js';
import { commands, system, uploads } from '../routes/tools/index.js';

// 保留特殊路由
import { cliAuth, customCommands } from '../routes/index.js';
import mcpUtilsRoutes from '../routes/mcp-utils.js';

// 中间件导入
import { validateApiKey, authenticateToken } from '../middleware/auth.js';
import { responseFormatter, responseHeaders } from '../middleware/response-formatter.middleware.js';

/**
 * 使用中间件和路由配置 Express 应用
 * @param {express.Application} app - 要配置的 Express 应用
 * @param {WebSocketServer} wss - WebSocket 服务器（附加到 app.locals）
 */
export function configureExpress(app, wss) {
    // 使 WebSocket 服务器对路由可用
    app.locals.wss = wss;

    // CORS 中间件 - 必须支持 credentials 以允许 cookie 认证
    app.use(cors({
        origin: ['http://localhost:5173', 'http://localhost:3001', 'http://192.168.8.106:5173'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Cookie 解析中间件（用于 httpOnly 认证）
    app.use(cookieParser());

    // 响应格式化中间件（必须在所有其他中间件之前）
    app.use(responseFormatter);
    app.use(responseHeaders);

    // 带有自定义类型检查的 JSON 主体解析器
    app.use(express.json({
        limit: FILES.maxUploadSize,
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
    app.use(express.urlencoded({ limit: FILES.maxUploadSize, extended: true }));

    // 公共健康检查端点（无需身份验证）
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });

    // ===== 公共路由（无需身份验证）=====
    // 认证路由必须在 validateApiKey 之前定义
    app.use('/api/auth', auth);

    // 可选的 API 密钥验证（如果已配置）
    // 只对非认证路由生效
    app.use('/api', validateApiKey);

    // ===== 核心路由 =====
    app.use('/api/settings', authenticateToken, settings);
    app.use('/api/users', authenticateToken, users);

    // ===== 资源路由 =====
    app.use('/api/projects', authenticateToken, projects);
    app.use('/api/sessions', authenticateToken, sessions);
    app.use('/api/projects', authenticateToken, files);
    app.use('/api/git', authenticateToken, git);

    // ===== 集成路由 - AI 提供商 =====
    app.use('/api/claude', authenticateToken, claude);
    app.use('/api/cursor', authenticateToken, cursor);
    app.use('/api/codex', authenticateToken, codex);

    // ===== 集成路由 - 其他集成 =====
    app.use('/api/mcp', authenticateToken, mcp);
    app.use('/api/mcp-utils', authenticateToken, mcpUtilsRoutes);
    app.use('/api/taskmaster', authenticateToken, taskmaster);

    // ===== 特殊路由 =====
    // Agent API 路由（使用 API 密钥身份验证，不是令牌身份验证）
    app.use('/api/agent', agent);

    // CLI 认证路由
    app.use('/api/cli', authenticateToken, cliAuth);

    // ===== 工具路由 =====
    app.use('/api/tools/commands', authenticateToken, commands);
    app.use('/api/system', authenticateToken, system);
    app.use('/api/uploads', authenticateToken, uploads);

    // 自定义命令路由（与 tools/commands 不同）
    app.use('/api/commands', authenticateToken, customCommands);

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
        if (fs.existsSync(indexPath)) {
            // 为 HTML 设置无缓存头以防止 Service Worker 问题
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.sendFile(indexPath);
        } else {
            // 在开发环境中，仅当 dist 不存在时重定向到 Vite 开发服务器
            res.redirect(`http://localhost:${SERVER.vitePort}`);
        }
    });
}
