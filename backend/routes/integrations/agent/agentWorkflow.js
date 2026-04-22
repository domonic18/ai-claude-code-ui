/**
 * agentWorkflow.js
 *
 * Agent 工作流辅助函数：项目路径解析、GitHub 工作流执行、Writer 创建
 *
 * @module routes/integrations/agent/agentWorkflow
 */

import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import { addProjectManually } from '../../../services/projects/index.js';
import {
    cloneGitHubRepo,
    autogenerateBranchName,
    validateBranchName,
    executeGitHubWorkflow,
} from '../../../services/scm/GitHubService.js';
import { SSEStreamWriter, ResponseCollector } from '../../../services/execution/AgentWriter.js';
import { repositories } from '../../../database/db.js';
import { CODEX_MODELS } from '../../../../shared/modelConstants.js';
import { queryClaudeSDK } from '../../../services/execution/claude/index.js';
import { spawnCursor } from '../../../services/execution/cursor/index.js';
import { queryCodex } from '../../../services/execution/codex/index.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('routes/integrations/agent/workflow');
const { GitHubToken } = repositories;

// ─── Provider 策略 ──────────────────────────────────────────

/**
 * AI 提供者执行策略映射表
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

// 定义 HTTP 路由处理器
/**
 * 执行 AI 会话（策略分发）
 * @param {string} provider - 提供者名称
 * @param {string} message - 用户消息
 * @param {Object} sdkOptions - SDK 选项
 * @param {Object} writer - 输出写入器
 */
export async function executeProvider(provider, message, sdkOptions, writer) {
    const strategy = PROVIDER_STRATEGIES[provider];
    if (!strategy) throw new Error(`Unknown provider: ${provider}`);
    return strategy(message, sdkOptions, writer);
}

// ─── 项目路径解析 ──────────────────────────────────────────

// 定义 HTTP 路由处理器
/**
 * 解析最终的项目路径（克隆或验证本地路径）
 * @param {Object} params - 请求参数
 * @param {Object} user - 认证用户
 * @returns {Promise<string>} 最终的项目路径
 */
export async function resolveProjectPath(params, user) {
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

// 定义 HTTP 路由处理器
/**
 * 注册项目到数据库
 * @param {number} userId - 用户 ID
 * @param {string} projectPath - 项目路径
 */
export async function registerProject(userId, projectPath) {
    try {
        const projectName = path.basename(projectPath);
        await addProjectManually(userId, projectName);
    } catch (error) {
        if (!error.message?.includes('Project already configured')) throw error;
    }
}

// ─── GitHub 工作流 ──────────────────────────────────────────

// 定义 HTTP 路由处理器
/**
 * 执行 GitHub 分支/PR 工作流
 * @param {Object} params - 请求参数
 * @param {string} projectPath - 项目路径
 * @param {Object} user - 认证用户
 * @param {boolean} stream - 是否流式响应
 * @param {Object} writer - 输出写入器
 * @returns {Object} { branchInfo, prInfo }
 */
export async function executeGitHubBranchWorkflow(params, projectPath, user, stream, writer) {
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

// ─── Writer 创建 ──────────────────────────────────────────

// 处理 POST 请求创建资源
/**
 * 创建输出 Writer（SSE 流或响应收集器）
 * @param {boolean} stream - 是否流式
 * @param {Object} res - Express 响应对象
 * @returns {Object} Writer 实例
 */
export function createWriter(stream, res) {
    if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        return new SSEStreamWriter(res);
    }
    return new ResponseCollector();
}

