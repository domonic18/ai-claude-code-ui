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

// ─── 参数归一化工具 ──────────────────────────────────────────

/**
 * 将各种形式的布尔参数归一化为 true/false
 * @param {*} value - 原始参数值
 * @param {boolean} defaultVal - 默认值
 * @returns {boolean} 归一化后的布尔值
 */
function normalizeBoolean(value, defaultVal = false) {
    if (value === undefined) return defaultVal;
    return value === true || value === 'true';
}

/**
 * 校验并归一化 agent 请求参数
 * @param {Object} body - 请求体
 * @returns {Object} 归一化后的参数对象
 */
function normalizeAgentParams(body) {
    const { githubUrl, projectPath, message, provider = 'claude', model, githubToken, branchName } = body;
    return {
        githubUrl, projectPath, message, provider, model, githubToken, branchName,
        stream: normalizeBoolean(body.stream, true),
        cleanup: normalizeBoolean(body.cleanup, true),
        createBranch: branchName ? true : normalizeBoolean(body.createBranch, false),
        createPR: normalizeBoolean(body.createPR, false),
    };
}

// ─── Provider 策略 ──────────────────────────────────────────

/**
 * AI 提供者执行策略映射表
 * 每个策略接收 (message, sdkOptions, writer) 并执行对应的 AI 会话
 */
const PROVIDER_STRATEGIES = {
    claude: (message, sdkOptions, writer) => {
        logger.info({ provider: 'claude', model: sdkOptions.model, projectPath: sdkOptions.projectPath }, 'Starting Claude SDK session');
        return queryClaudeSDK(message, { ...sdkOptions, permissionMode: 'bypassPermissions' }, writer);
    },
    cursor: (message, sdkOptions, writer) => {
        logger.info({ provider: 'cursor', model: sdkOptions.model, projectPath: sdkOptions.projectPath }, 'Starting Cursor CLI session');
        return spawnCursor(message, { ...sdkOptions, model: sdkOptions.model || undefined, skipPermissions: true }, writer);
    },
    codex: (message, sdkOptions, writer) => {
        logger.info({ provider: 'codex', model: sdkOptions.model, projectPath: sdkOptions.projectPath }, 'Starting Codex SDK session');
        return queryCodex(message, { ...sdkOptions, model: sdkOptions.model || CODEX_MODELS.DEFAULT, permissionMode: 'bypassPermissions' }, writer);
    },
};

/**
 * 执行 AI 会话（策略分发）
 * @param {string} provider - 提供者名称
 * @param {string} message - 用户消息
 * @param {Object} sdkOptions - SDK 选项
 * @param {Object} writer - 输出写入器
 */
async function executeProvider(provider, message, sdkOptions, writer) {
    const strategy = PROVIDER_STRATEGIES[provider];
    if (!strategy) throw new Error(`Unknown provider: ${provider}`);
    return strategy(message, sdkOptions, writer);
}

// ─── 参数校验 ──────────────────────────────────────────────

const ALLOWED_GIT_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org'];
const VALID_PROVIDERS = ['claude', 'cursor', 'codex'];

/**
 * 校验 agent 请求参数，返回错误信息或 null
 * @param {Object} params - 归一化后的参数
 * @returns {string|null} 错误信息，校验通过返回 null
 */
function validateAgentParams(params) {
    if (!params.githubUrl && !params.projectPath) {
        return 'Either githubUrl or projectPath is required';
    }
    if (!params.message || !params.message.trim()) {
        return 'message is required';
    }
    if (!VALID_PROVIDERS.includes(params.provider)) {
        return 'provider must be "claude", "cursor", or "codex"';
    }
    if (params.githubUrl) {
        try {
            const parsed = new URL(params.githubUrl.trim());
            if (!['https:', 'http:'].includes(parsed.protocol)) {
                return 'githubUrl must use http or https protocol';
            }
            if (!ALLOWED_GIT_HOSTS.includes(parsed.hostname.toLowerCase())) {
                return `githubUrl host must be one of: ${ALLOWED_GIT_HOSTS.join(', ')}`;
            }
        } catch {
            return 'githubUrl is not a valid URL';
        }
    }
    if ((params.createBranch || params.createPR) && !params.githubUrl && !params.projectPath) {
        return 'createBranch and createPR require either githubUrl or projectPath with a GitHub remote';
    }
    return null;
}

/**
 * 校验 projectPath 安全性
 * @param {string} projectPath - 项目路径
 * @returns {string|null} 错误信息，校验通过返回 null
 */
function validateProjectPath(projectPath) {
    const resolved = path.resolve(projectPath);
    const externalProjectsDir = path.join(os.homedir(), '.claude', 'external-projects');
    if (!resolved.startsWith(os.homedir()) && !resolved.startsWith(externalProjectsDir)) {
        return 'projectPath must be within the user home directory';
    }
    if (resolved.includes('..')) {
        return 'projectPath cannot contain path traversal sequences';
    }
    return null;
}

// ─── 项目路径解析 ──────────────────────────────────────────

/**
 * 解析最终的项目路径（克隆或验证本地路径）
 * @param {Object} params - 请求参数
 * @param {Object} user - 认证用户
 * @returns {Promise<string>} 最终的项目路径
 */
async function resolveProjectPath(params, user) {
    if (params.githubUrl) {
        const tokenToUse = params.githubToken || GitHubToken.getActive(user.userId);
        const targetPath = params.projectPath || path.join(
            os.homedir(), '.claude', 'external-projects',
            crypto.createHash('md5').update(params.githubUrl + Date.now()).digest('hex')
        );
        return cloneGitHubRepo(params.githubUrl.trim(), tokenToUse, targetPath);
    }

    const resolvedPath = path.resolve(params.projectPath);
    try {
        await fs.access(resolvedPath);
    } catch {
        throw new Error(`Project path does not exist: ${resolvedPath}`);
    }
    return resolvedPath;
}

/**
 * 注册项目到数据库
 * @param {number} userId - 用户 ID
 * @param {string} projectPath - 项目路径
 */
async function registerProject(userId, projectPath) {
    try {
        const projectName = path.basename(projectPath);
        await addProjectManually(userId, projectName);
    } catch (error) {
        if (!error.message?.includes('Project already configured')) throw error;
    }
}

// ─── GitHub 工作流 ──────────────────────────────────────────

/**
 * 执行 GitHub 分支/PR 工作流
 * @param {Object} params - 请求参数
 * @param {string} projectPath - 项目路径
 * @param {Object} user - 认证用户
 * @param {boolean} stream - 是否流式响应
 * @param {Object} writer - 输出写入器
 * @returns {Object} { branchInfo, prInfo }
 */
async function executeGitHubBranchWorkflow(params, projectPath, user, stream, writer) {
    const tokenToUse = params.githubToken || GitHubToken.getActive(user.userId);
    if (!tokenToUse) {
        throw new Error('GitHub token required for branch/PR creation. Please configure a GitHub token in settings.');
    }

    const finalBranchName = params.branchName || autogenerateBranchName(params.message);
    if (params.branchName) {
        const validation = validateBranchName(finalBranchName);
        if (!validation.valid) {
            throw new Error(`Invalid branch name: ${validation.error}`);
        }
    }

    const result = await executeGitHubWorkflow({
        githubUrl: params.githubUrl,
        projectPath,
        branchName: finalBranchName,
        createBranch: params.createBranch,
        createPR: params.createPR,
        githubToken: tokenToUse,
        message: params.message,
    });

    if (stream) {
        if (result.branchInfo) writer.send({ type: 'github-branch', branch: result.branchInfo });
        if (result.prInfo) writer.send({ type: 'github-pr', pullRequest: result.prInfo });
    }

    return { branchInfo: result.branchInfo, prInfo: result.prInfo };
}

// ─── 认证中间件 ────────────────────────────────────────────

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

// ─── Writer 创建 ──────────────────────────────────────────

/**
 * 创建输出 Writer（SSE 流或响应收集器）
 * @param {boolean} stream - 是否流式
 * @param {Object} res - Express 响应对象
 * @returns {Object} Writer 实例
 */
function createWriter(stream, res) {
    if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        return new SSEStreamWriter(res);
    }
    return new ResponseCollector();
}

// ─── Agent 端点 ──────────────────────────────────────────

/**
 * POST /api/agent
 *
 * 触发 AI 代理（Claude / Cursor / Codex）在项目上工作。
 * 支持 GitHub 仓库克隆、自动分支创建和 Pull Request。
 */
router.post('/', validateExternalApiKey, async (req, res) => {
    const params = normalizeAgentParams(req.body);

    // 参数校验
    const validationError = validateAgentParams(params);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    // projectPath 路径安全校验
    if (params.projectPath && !params.githubUrl) {
        const pathError = validateProjectPath(params.projectPath);
        if (pathError) {
            return res.status(400).json({ error: pathError });
        }
    }

    let finalProjectPath = null;
    let writer = null;

    try {
        // 确定项目路径
        finalProjectPath = await resolveProjectPath(params, req.user);

        // 注册项目
        await registerProject(req.user.userId, finalProjectPath);

        // 设置 Writer
        writer = createWriter(params.stream, res);
        writer.send({
            type: 'status',
            message: params.githubUrl ? 'Repository cloned and session started' : 'Session started',
            projectPath: finalProjectPath,
        });

        // 启动 AI 会话
        await executeProvider(params.provider, params.message.trim(), {
            projectPath: finalProjectPath,
            cwd: finalProjectPath,
            sessionId: null,
            model: params.model,
        }, writer);

        // GitHub 分支/PR 创建
        let branchInfo = null;
        let prInfo = null;

        if (params.createBranch || params.createPR) {
            try {
                const result = await executeGitHubBranchWorkflow(params, finalProjectPath, req.user, params.stream, writer);
                branchInfo = result.branchInfo;
                prInfo = result.prInfo;
            } catch (error) {
                logger.error({ error: error.message }, 'GitHub branch/PR creation error');
                if (params.stream) {
                    writer.send({ type: 'github-error', error: error.message });
                } else {
                    branchInfo = { error: error.message };
                    prInfo = { error: error.message };
                }
            }
        }

        // 发送响应
        if (params.stream) {
            writer.end();
        } else {
            const response = {
                success: true,
                sessionId: writer.getSessionId(),
                messages: writer.getAssistantMessages(),
                tokens: writer.getTotalTokens(),
                projectPath: finalProjectPath,
            };
            if (branchInfo) response.branch = branchInfo;
            if (prInfo) response.pullRequest = prInfo;
            res.json(response);
        }

        // 异步清理
        if (params.cleanup && params.githubUrl) {
            const sessionIdForCleanup = writer.getSessionId();
            setTimeout(() => cleanupProject(finalProjectPath, sessionIdForCleanup), 5000);
        }

    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'External session error');

        // 错误时清理
        if (finalProjectPath && params.cleanup && params.githubUrl) {
            const sessionIdForCleanup = writer ? writer.getSessionId() : null;
            cleanupProject(finalProjectPath, sessionIdForCleanup);
        }

        if (params.stream) {
            if (!writer) {
                writer = createWriter(true, res);
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
