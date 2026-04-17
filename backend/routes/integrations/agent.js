/**
 * Agent API 路由
 * ==============
 *
 * 外部 Agent API 端点，支持通过 API Key 认证触发 AI 代理工作。
 * 支持 Claude、Cursor、Codex 三种引擎，以及 GitHub 分支/PR 自动创建。
 *
 * 路由层仅负责：认证、参数校验、编排流程、格式化响应。
 * GitHub 操作委托给 services/scm/GitHubService，
 * Writer 适配器委托给 services/execution/AgentWriter。
 *
 * @module routes/integrations/agent
 */

import express from 'express';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import { repositories } from '../../database/db.js';
import { addProjectManually } from '../../services/projects/index.js';
import { queryClaudeSDK } from '../../services/execution/claude/index.js';
import { spawnCursor } from '../../services/execution/cursor/index.js';
import { queryCodex } from '../../services/execution/codex/index.js';
import { SSEStreamWriter, ResponseCollector } from '../../services/execution/AgentWriter.js';
import {
    cloneGitHubRepo,
    autogenerateBranchName,
    validateBranchName,
    executeGitHubWorkflow,
    cleanupProject
} from '../../services/scm/GitHubService.js';
import { CODEX_MODELS } from '../../../shared/modelConstants.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/integrations/agent');
const { User, ApiKey, GitHubToken } = repositories;
const router = express.Router();

// ─── 认证中间件 ────────────────────────────────────────

/**
 * 验证代理 API 请求的中间件。
 * 支持平台模式（外部代理认证）和 API Key 模式（自托管）。
 */
const validateExternalApiKey = (req, res, next) => {
    if (process.env.VITE_IS_PLATFORM === 'true') {
        try {
            const user = User.getFirst();
            if (!user) {
                return res.status(500).json({ error: 'Platform mode: No user found in database' });
            }
            req.user = user;
            return next();
        } catch (error) {
            logger.error({ error: error.message }, 'Platform mode error');
            return res.status(500).json({ error: 'Platform mode: Failed to fetch user' });
        }
    }

    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    const user = ApiKey.validate(apiKey);
    if (!user) {
        return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    req.user = user;
    next();
};

// ─── Agent 端点 ────────────────────────────────────────

/**
 * POST /api/agent
 *
 * 触发 AI 代理（Claude / Cursor / Codex）在项目上工作。
 * 支持 GitHub 仓库克隆、自动分支创建和 Pull Request。
 *
 * @param {string} githubUrl - GitHub 仓库 URL（与 projectPath 二选一）
 * @param {string} projectPath - 本地项目路径（与 githubUrl 二选一）
 * @param {string} message - 任务描述（必填）
 * @param {string} [provider='claude'] - AI 提供者：claude | cursor | codex
 * @param {string} [model] - 模型标识
 * @param {boolean} [stream=true] - 是否启用 SSE 流式响应
 * @param {boolean} [cleanup=true] - 完成后是否自动清理克隆的仓库
 * @param {string} [githubToken] - GitHub 令牌（覆盖设置中的令牌）
 * @param {string} [branchName] - 自定义分支名（提供后自动启用 createBranch）
 * @param {boolean} [createBranch=false] - 完成后创建新分支
 * @param {boolean} [createPR=false] - 完成后创建 Pull Request
 */
router.post('/', validateExternalApiKey, async (req, res) => {
    const { githubUrl, projectPath, message, provider = 'claude', model, githubToken, branchName } = req.body;

    // 解析布尔参数（兼容 curl 传字符串 "true"/"false"）
    const stream = req.body.stream === undefined ? true : (req.body.stream === true || req.body.stream === 'true');
    const cleanup = req.body.cleanup === undefined ? true : (req.body.cleanup === true || req.body.cleanup === 'true');
    const createBranch = branchName ? true : (req.body.createBranch === true || req.body.createBranch === 'true');
    const createPR = req.body.createPR === true || req.body.createPR === 'true';

    // ─── 参数校验 ──────────────────────────────────
    if (!githubUrl && !projectPath) {
        return res.status(400).json({ error: 'Either githubUrl or projectPath is required' });
    }
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
    }
    if (!['claude', 'cursor', 'codex'].includes(provider)) {
        return res.status(400).json({ error: 'provider must be "claude", "cursor", or "codex"' });
    }
    if (githubUrl) {
        try {
            const parsed = new URL(githubUrl.trim());
            if (!['https:', 'http:'].includes(parsed.protocol)) {
                return res.status(400).json({ error: 'githubUrl must use http or https protocol' });
            }
            const allowedHosts = ['github.com', 'gitlab.com', 'bitbucket.org'];
            if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
                return res.status(400).json({ error: `githubUrl host must be one of: ${allowedHosts.join(', ')}` });
            }
        } catch {
            return res.status(400).json({ error: 'githubUrl is not a valid URL' });
        }
    }
    if ((createBranch || createPR) && !githubUrl && !projectPath) {
        return res.status(400).json({ error: 'createBranch and createPR require either githubUrl or projectPath with a GitHub remote' });
    }

    // projectPath 路径安全校验：必须在允许的目录范围内
    if (projectPath && !githubUrl) {
        const resolved = path.resolve(projectPath);
        const externalProjectsDir = path.join(os.homedir(), '.claude', 'external-projects');
        // 允许：用户主目录下的项目 或 external-projects 目录
        if (!resolved.startsWith(os.homedir()) && !resolved.startsWith(externalProjectsDir)) {
            return res.status(400).json({ error: 'projectPath must be within the user home directory' });
        }
        // 禁止路径穿越
        if (resolved.includes('..')) {
            return res.status(400).json({ error: 'projectPath cannot contain path traversal sequences' });
        }
    }

    let finalProjectPath = null;
    let writer = null;

    try {
        // ─── 确定项目路径 ──────────────────────────
        if (githubUrl) {
            const tokenToUse = githubToken || GitHubToken.getActive(req.user.userId);
            const targetPath = projectPath || path.join(
                os.homedir(), '.claude', 'external-projects',
                crypto.createHash('md5').update(githubUrl + Date.now()).digest('hex')
            );
            finalProjectPath = await cloneGitHubRepo(githubUrl.trim(), tokenToUse, targetPath);
        } else {
            finalProjectPath = path.resolve(projectPath);
            try {
                await fs.access(finalProjectPath);
            } catch {
                throw new Error(`Project path does not exist: ${finalProjectPath}`);
            }
        }

        // ─── 注册项目 ──────────────────────────────
        try {
            const projectName = path.basename(finalProjectPath);
            await addProjectManually(req.user.userId, projectName);
        } catch (error) {
            if (!error.message?.includes('Project already configured')) throw error;
        }

        // ─── 设置 Writer ─────────────────────────
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            writer = new SSEStreamWriter(res);
        } else {
            writer = new ResponseCollector();
        }

        writer.send({
            type: 'status',
            message: githubUrl ? 'Repository cloned and session started' : 'Session started',
            projectPath: finalProjectPath
        });

        // ─── 启动 AI 会话 ─────────────────────────
        const sdkOptions = {
            projectPath: finalProjectPath,
            cwd: finalProjectPath,
            sessionId: null,
            model: model
        };

        if (provider === 'claude') {
            logger.info({ provider, model, projectPath: finalProjectPath }, 'Starting Claude SDK session');
            await queryClaudeSDK(message.trim(), { ...sdkOptions, permissionMode: 'bypassPermissions' }, writer);
        } else if (provider === 'cursor') {
            logger.info({ provider, model, projectPath: finalProjectPath }, 'Starting Cursor CLI session');
            await spawnCursor(message.trim(), { ...sdkOptions, model: model || undefined, skipPermissions: true }, writer);
        } else if (provider === 'codex') {
            logger.info({ provider, model, projectPath: finalProjectPath }, 'Starting Codex SDK session');
            await queryCodex(message.trim(), { ...sdkOptions, model: model || CODEX_MODELS.DEFAULT, permissionMode: 'bypassPermissions' }, writer);
        }

        // ─── GitHub 分支/PR 创建 ──────────────────
        let branchInfo = null;
        let prInfo = null;

        if (createBranch || createPR) {
            try {
                const tokenToUse = githubToken || GitHubToken.getActive(req.user.userId);
                if (!tokenToUse) {
                    throw new Error('GitHub token required for branch/PR creation. Please configure a GitHub token in settings.');
                }

                const finalBranchName = branchName || autogenerateBranchName(message);
                if (branchName) {
                    const validation = validateBranchName(finalBranchName);
                    if (!validation.valid) {
                        throw new Error(`Invalid branch name: ${validation.error}`);
                    }
                }

                const result = await executeGitHubWorkflow({
                    githubUrl,
                    projectPath: finalProjectPath,
                    branchName: finalBranchName,
                    createBranch,
                    createPR,
                    githubToken: tokenToUse,
                    message
                });

                branchInfo = result.branchInfo;
                prInfo = result.prInfo;

                if (stream) {
                    if (branchInfo) writer.send({ type: 'github-branch', branch: branchInfo });
                    if (prInfo) writer.send({ type: 'github-pr', pullRequest: prInfo });
                }
            } catch (error) {
                logger.error({ error: error.message }, 'GitHub branch/PR creation error');
                if (stream) {
                    writer.send({ type: 'github-error', error: error.message });
                } else {
                    branchInfo = { error: error.message };
                    prInfo = { error: error.message };
                }
            }
        }

        // ─── 发送响应 ─────────────────────────────
        if (stream) {
            writer.end();
        } else {
            const response = {
                success: true,
                sessionId: writer.getSessionId(),
                messages: writer.getAssistantMessages(),
                tokens: writer.getTotalTokens(),
                projectPath: finalProjectPath
            };
            if (branchInfo) response.branch = branchInfo;
            if (prInfo) response.pullRequest = prInfo;
            res.json(response);
        }

        // ─── 异步清理 ─────────────────────────────
        if (cleanup && githubUrl) {
            const sessionIdForCleanup = writer.getSessionId();
            setTimeout(() => {
                cleanupProject(finalProjectPath, sessionIdForCleanup);
            }, 5000);
        }

    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'External session error');

        // 错误时清理
        if (finalProjectPath && cleanup && githubUrl) {
            const sessionIdForCleanup = writer ? writer.getSessionId() : null;
            cleanupProject(finalProjectPath, sessionIdForCleanup);
        }

        if (stream) {
            if (!writer) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                writer = new SSEStreamWriter(res);
            }
            if (!res.writableEnded) {
                writer.send({ type: 'error', error: error.message, message: `Failed: ${error.message}` });
                writer.end();
            }
        } else if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

export default router;
