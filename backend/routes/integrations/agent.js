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
import { createLogger } from '../../utils/logger.js';
import { normalizeAgentParams, validateAgentParams, validateProjectPath } from './agent/agentParams.js';
import { validateExternalApiKey } from './agent/agentAuth.js';
import {
    executeProvider,
    resolveProjectPath,
    registerProject,
    createWriter,
} from './agent/agentWorkflow.js';
import {
    handleGitHubWorkflow,
    sendResponse,
    handleAgentError,
    scheduleCleanup,
} from './agentGitOperations.js';

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
        scheduleCleanup(params, finalProjectPath, writer);

    } catch (error) {
        handleAgentError(error, params, res, writer, finalProjectPath);
    }
});

export default router;
