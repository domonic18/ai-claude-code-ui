/**
 * Agent API 路由
 * ==============
 *
 * 外部 Agent API 端点，支持通过 API Key 认证触发 AI 代理工作。
 * 支持 Claude、Cursor、Codex 三种引擎，以及 GitHub 分支/PR 自动创建。
 *
 * 路由层仅负责：路由编排、响应格式化。
 * 具体逻辑委托给 agent/ 子模块。
 *
 * @module routes/integrations/agent
 */

import express from 'express';
import { cleanupProject } from '../../services/scm/GitHubService.js';
import { createLogger } from '../../utils/logger.js';
import { normalizeAgentParams, validateAgentParams, validateProjectPath } from './agent/agentParams.js';
import { validateExternalApiKey } from './agent/agentAuth.js';
import {
    executeProvider,
    resolveProjectPath,
    registerProject,
    executeGitHubBranchWorkflow,
    createWriter,
} from './agent/agentWorkflow.js';

const logger = createLogger('routes/integrations/agent');
const router = express.Router();

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
        finalProjectPath = await resolveProjectPath(params, req.user);
        await registerProject(req.user.userId, finalProjectPath);

        writer = createWriter(params.stream, res);
        writer.send({
            type: 'status',
            message: params.githubUrl ? 'Repository cloned and session started' : 'Session started',
            projectPath: finalProjectPath,
        });

        await executeProvider(params.provider, params.message.trim(), {
            projectPath: finalProjectPath,
            cwd: finalProjectPath,
            sessionId: null,
            model: params.model,
        }, writer);

        // GitHub 分支/PR 创建
        const ghResult = await handleGitHubWorkflow(params, finalProjectPath, req.user, writer);

        // 发送响应
        sendResponse(params, res, writer, finalProjectPath, ghResult);

        // 异步清理
        if (params.cleanup && params.githubUrl) {
            setTimeout(() => cleanupProject(finalProjectPath, writer.getSessionId()), 5000);
        }

    } catch (error) {
        handleAgentError(error, params, res, writer, finalProjectPath);
    }
});

/**
 * 处理 GitHub 分支/PR 工作流（可选）
 */
async function handleGitHubWorkflow(params, projectPath, user, writer) {
    if (!params.createBranch && !params.createPR) {
        return { branchInfo: null, prInfo: null };
    }

    try {
        return await executeGitHubBranchWorkflow(params, projectPath, user, params.stream, writer);
    } catch (error) {
        logger.error({ error: error.message }, 'GitHub branch/PR creation error');
        if (params.stream) {
            writer.send({ type: 'github-error', error: error.message });
        }
        return { branchInfo: { error: error.message }, prInfo: { error: error.message } };
    }
}

/**
 * 发送成功响应
 */
function sendResponse(params, res, writer, projectPath, ghResult) {
    if (params.stream) {
        writer.end();
        return;
    }

    const response = {
        success: true,
        sessionId: writer.getSessionId(),
        messages: writer.getAssistantMessages(),
        tokens: writer.getTotalTokens(),
        projectPath,
    };
    if (ghResult.branchInfo && !ghResult.branchInfo.error) response.branch = ghResult.branchInfo;
    if (ghResult.prInfo && !ghResult.prInfo.error) response.pullRequest = ghResult.prInfo;
    res.json(response);
}

/**
 * 处理 Agent 错误
 */
function handleAgentError(error, params, res, writer, finalProjectPath) {
    logger.error({ error: error.message, stack: error.stack }, 'External session error');

    if (finalProjectPath && params.cleanup && params.githubUrl) {
        const sessionIdForCleanup = writer ? writer.getSessionId() : null;
        cleanupProject(finalProjectPath, sessionIdForCleanup);
    }

    if (params.stream) {
        const w = writer || createWriter(true, res);
        if (!res.writableEnded) {
            w.send({ type: 'error', error: error.message, message: `Failed: ${error.message}` });
            w.end();
        }
    } else if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export default router;
