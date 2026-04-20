/**
 * Agent Git Operations
 * ====================
 *
 * GitHub repository cloning and branch/PR management operations.
 * Extracted from agent.js to reduce complexity.
 *
 * @module routes/integrations/agentGitOperations
 */

import { cleanupProject } from '../../services/scm/GitHubService.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/integrations/agentGitOperations');

/**
 * Handle GitHub branch/PR workflow (optional)
 *
 * @param {Object} params - Agent parameters
 * @param {string} projectPath - Project path
 * @param {Object} user - User object
 * @param {Object} writer - Response writer
 * @returns {Promise<Object>} GitHub workflow result
 */
export async function handleGitHubWorkflow(params, projectPath, user, writer) {
    if (!params.createBranch && !params.createPR) {
        return { branchInfo: null, prInfo: null };
    }

    try {
        const { executeGitHubBranchWorkflow } = await import('./agent/agentWorkflow.js');
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
 * Send successful response
 *
 * @param {Object} params - Agent parameters
 * @param {Object} res - Express response object
 * @param {Object} writer - Response writer
 * @param {string} projectPath - Project path
 * @param {Object} ghResult - GitHub workflow result
 */
export function sendResponse(params, res, writer, projectPath, ghResult) {
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
 * Handle Agent error
 *
 * @param {Error} error - Error object
 * @param {Object} params - Agent parameters
 * @param {Object} res - Express response object
 * @param {Object} writer - Response writer
 * @param {string} finalProjectPath - Final project path
 */
export function handleAgentError(error, params, res, writer, finalProjectPath) {
    logger.error({ error: error.message, stack: error.stack }, 'External session error');

    if (finalProjectPath && params.cleanup && params.githubUrl) {
        const sessionIdForCleanup = writer ? writer.getSessionId() : null;
        cleanupProject(finalProjectPath, sessionIdForCleanup);
    }

    if (params.stream) {
        const { createWriter } = require('./agent/agentWorkflow.js');
        const w = writer || createWriter(true, res);
        if (!res.writableEnded) {
            w.send({ type: 'error', error: error.message, message: `Failed: ${error.message}` });
            w.end();
        }
    } else if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Schedule cleanup task
 *
 * @param {Object} params - Agent parameters
 * @param {string} finalProjectPath - Final project path
 * @param {Object} writer - Response writer
 */
export function scheduleCleanup(params, finalProjectPath, writer) {
    if (params.cleanup && params.githubUrl) {
        setTimeout(() => cleanupProject(finalProjectPath, writer.getSessionId()), 5000);
    }
}
