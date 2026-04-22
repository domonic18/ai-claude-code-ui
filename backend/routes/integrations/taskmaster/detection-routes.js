/**
 * TaskMaster 检测路由
 *
 * 提供安装状态检测、项目配置检测、批量检测等端点。
 *
 * @module routes/integrations/taskmaster/detection-routes
 */

import express from 'express';
import { detectTaskMasterMCPServer } from '../../../utils/mcp-detector.js';
import { CONTAINER } from '../../../config/config.js';
import { createLogger } from '../../../utils/logger.js';
import { resolveProjectPath, determineConfigStatus } from './helpers.js';

import {
    checkTaskMasterInstallation
} from '../../../services/projects/taskmaster/index.js';

const logger = createLogger('routes/integrations/taskmaster/detection');
const router = express.Router();

/**
 * GET /installation-status
 * 检查系统上是否已安装 TaskMaster CLI
 */
router.get('/installation-status', async (req, res) => {
    try {
        const [installationStatus, mcpStatus] = await Promise.all([
            checkTaskMasterInstallation(),
            detectTaskMasterMCPServer()
        ]);

        res.json({
            success: true,
            installation: installationStatus,
            mcpServer: mcpStatus,
            isReady: installationStatus.isInstalled && mcpStatus.hasMCPServer
        });
    } catch (error) {
        logger.error('Error checking TaskMaster installation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check TaskMaster installation status',
            installation: { isInstalled: false, reason: `Server error: ${error.message}` },
            mcpServer: { hasMCPServer: false, reason: `Server error: ${error.message}` },
            isReady: false
        });
    }
});

/**
 * GET /detect/:projectName
 * 检测特定项目的 TaskMaster 配置
 */
router.get('/detect/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const { detectTaskMasterFolder } = await import('../../../services/projects/taskmaster/index.js');
        const [taskMasterResult, mcpResult] = await Promise.all([
            detectTaskMasterFolder(projectPath),
            detectTaskMasterMCPServer()
        ]);

        res.json({
            projectName,
            projectPath,
            status: determineConfigStatus(taskMasterResult, mcpResult),
            taskmaster: taskMasterResult,
            mcp: mcpResult,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('TaskMaster detection error:', error);
        res.status(500).json({ error: 'Failed to detect TaskMaster configuration', message: error.message });
    }
});

// 定义 HTTP 路由处理器
/**
 * GET /detect-all
 * 检测所有已知项目的 TaskMaster 配置（容器模式）
 */
router.get('/detect-all', async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User ID required', code: 'USER_ID_REQUIRED' });
        }

        const { getProjectsInContainer } = await import('../../projects.js');
        const { detectTaskMasterFolder } = await import('../../../services/projects/taskmaster/index.js');
        const projects = await getProjectsInContainer(userId);

        const results = await Promise.all(projects.map(async (project) => {
            try {
                const projectPath = `${CONTAINER.paths.workspace}/${project.name}`;
                const [taskMasterResult, mcpResult] = await Promise.all([
                    detectTaskMasterFolder(projectPath),
                    detectTaskMasterMCPServer()
                ]);

                return {
                    projectName: project.name,
                    displayName: project.displayName,
                    projectPath,
                    status: determineConfigStatus(taskMasterResult, mcpResult),
                    taskmaster: taskMasterResult,
                    mcp: mcpResult
                };
            } catch (error) {
                return {
                    projectName: project.name,
                    displayName: project.displayName,
                    status: 'error',
                    error: error.message
                };
            }
        }));

        const summary = {
            total: results.length,
            fullyConfigured: results.filter(p => p.status === 'fully-configured').length,
            taskmasterOnly: results.filter(p => p.status === 'taskmaster-only').length,
            mcpOnly: results.filter(p => p.status === 'mcp-only').length,
            notConfigured: results.filter(p => p.status === 'not-configured').length,
            errors: results.filter(p => p.status === 'error').length
        };

        res.json({ projects: results, summary, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('Bulk TaskMaster detection error:', error);
        res.status(500).json({ error: 'Failed to detect TaskMaster configuration for projects', message: error.message });
    }
});

export default router;

