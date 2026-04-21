/**
 * TaskMaster 任务检测与管理路由
 *
 * 提供 TaskMaster 安装检测、项目配置检测、
 * 任务列表加载和下一个推荐任务的 API 端点。
 *
 * 端点列表：
 * - GET  /installation-status   - 检查系统 TaskMaster CLI 安装状态
 * - GET  /detect/:projectName   - 检测特定项目的 TaskMaster 配置
 * - GET  /detect-all            - 批量检测所有项目的 TaskMaster 配置
 * - GET  /next/:projectName     - 获取下一个推荐任务
 * - GET  /tasks/:projectName    - 从 tasks.json 加载任务列表
 *
 * @module routes/integrations/taskmaster/task-routes
 */

import express from 'express';
import { detectTaskMasterMCPServer } from '../../../utils/mcp-detector.js';
import { CONTAINER } from '../../../config/config.js';
import { createLogger } from '../../../utils/logger.js';
import {
    checkTaskMasterInstallation,
    getNextTask,
    loadTasks,
    findNextPendingTask,
} from '../../../services/projects/taskmaster/index.js';
import {
    resolveProjectPath,
    determineConfigStatus,
} from './task-helpers.js';

const logger = createLogger('routes/integrations/taskmaster/task-routes');
const router = express.Router();

/**
 * GET /installation-status
 * 检查系统上是否已安装 TaskMaster CLI
 */
router.get('/installation-status', async (req, res) => {
    try {
        // 并行检查 TaskMaster CLI 安装状态和 MCP 服务器配置
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

        // 并行检测所有项目的 TaskMaster 配置
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

/**
 * GET /next/:projectName
 * 使用 task-master CLI 获取下一个推荐任务
 */
router.get('/next/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        try {
            const nextTaskData = await getNextTask(projectPath);
            res.json({
                projectName,
                projectPath,
                nextTask: nextTaskData,
                timestamp: new Date().toISOString()
            });
        } catch (cliError) {
            logger.warn('Failed to execute task-master CLI:', cliError.message);

            // CLI 不可用时回退：从本地 tasks.json 文件查找下一个待处理任务
            const nextTask = await findNextPendingTask(projectPath);
            res.json({
                projectName,
                projectPath,
                nextTask,
                fallback: true,
                message: 'Used fallback method (CLI not available)',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        logger.error('TaskMaster next task error:', error);
        res.status(500).json({ error: 'Failed to get next task', message: error.message });
    }
});

/**
 * GET /tasks/:projectName
 * 从 .taskmaster/tasks/tasks.json 加载实际任务
 */
router.get('/tasks/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const result = await loadTasks(projectPath);
        res.json(result);
    } catch (error) {
        logger.error('TaskMaster tasks loading error:', error);
        res.status(500).json({ error: 'Failed to load TaskMaster tasks', message: error.message });
    }
});

export default router;
