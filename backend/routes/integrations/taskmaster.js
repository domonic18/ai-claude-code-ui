/**
 * TaskMaster API 路由
 * ====================
 *
 * 提供 TaskMaster 集成的 HTTP API 端点。
 * 路由层仅负责：参数校验、调用 service、格式化响应。
 * 所有业务逻辑委托给 services/projects/taskmaster/ 模块。
 *
 * @module routes/integrations/taskmaster
 */

import express from 'express';
import path from 'path';
import { promises as fsPromises, constants as fsConstants } from 'fs';
import { detectTaskMasterMCPServer } from '../../utils/mcp-detector.js';
import { broadcastTaskMasterProjectUpdate, broadcastTaskMasterTasksUpdate } from '../../utils/taskmaster-websocket.js';
import { CONTAINER } from '../../config/config.js';
import { createLogger } from '../../utils/logger.js';
import {
    checkTaskMasterInstallation,
    getNextTask,
    initTaskMaster,
    addTask as addTaskCli,
    setTaskStatus,
    updateTask as updateTaskCli,
    parsePRD as parsePRDCli,
    loadTasks,
    findNextPendingTask,
    getAvailableTemplates,
    getTemplateById,
    applyCustomizations,
    listPrdFiles,
    readPrdFile,
    writePrdFile,
    deletePrdFile,
    isValidPrdFileName,
    prdFileExists
} from '../../services/projects/taskmaster/index.js';

const logger = createLogger('routes/integrations/taskmaster');
const router = express.Router();

// ─── 辅助函数 ───────────────────────────────────────────

/**
 * 获取项目路径（容器模式）
 * @param {string} projectName - 项目名称
 * @returns {string} 容器内的项目路径
 */
function getProjectPath(projectName) {
    return `/workspace/${projectName}`;
}

/**
 * 解析并校验项目路径可访问性
 * @param {string} projectName - 项目名称
 * @param {Object} res - Express response 对象
 * @returns {Promise<string|null>} 项目路径，校验失败返回 null（已发送响应）
 */
async function resolveProjectPath(projectName, res) {
    const projectPath = getProjectPath(projectName);
    try {
        await fsPromises.access(projectPath, fsConstants.R_OK);
        return projectPath;
    } catch {
        res.status(404).json({
            error: 'Project not found',
            message: `Project "${projectName}" does not exist`
        });
        return null;
    }
}

/**
 * 确定 TaskMaster 的配置状态
 * @param {Object} taskMasterResult - .taskmaster 检测结果
 * @param {Object} mcpResult - MCP 检测结果
 * @returns {string} 状态：fully-configured | taskmaster-only | mcp-only | not-configured
 */
function determineConfigStatus(taskMasterResult, mcpResult) {
    if (taskMasterResult.hasTaskmaster && taskMasterResult.hasEssentialFiles) {
        if (mcpResult.hasMCPServer && mcpResult.isConfigured) {
            return 'fully-configured';
        }
        return 'taskmaster-only';
    }
    if (mcpResult.hasMCPServer && mcpResult.isConfigured) {
        return 'mcp-only';
    }
    return 'not-configured';
}

/**
 * 通过 WebSocket 广播任务更新（如果 wss 可用）
 * @param {Object} req - Express request 对象
 * @param {string} projectName - 项目名称
 */
function broadcastTasks(req, projectName) {
    if (req.app.locals.wss) {
        broadcastTaskMasterTasksUpdate(req.app.locals.wss, projectName);
    }
}

/**
 * 通过 WebSocket 广播项目更新（如果 wss 可用）
 * @param {Object} req - Express request 对象
 * @param {string} projectName - 项目名称
 * @param {Object} data - 更新数据
 */
function broadcastProject(req, projectName, data) {
    if (req.app.locals.wss) {
        broadcastTaskMasterProjectUpdate(req.app.locals.wss, projectName, data);
    }
}

// ─── 安装与检测路由 ─────────────────────────────────────

/**
 * GET /api/taskmaster/installation-status
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
 * GET /api/taskmaster/detect/:projectName
 * 检测特定项目的 TaskMaster 配置
 */
router.get('/detect/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const { detectTaskMasterFolder } = await import('../../services/projects/taskmaster/index.js');
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
 * GET /api/taskmaster/detect-all
 * 检测所有已知项目的 TaskMaster 配置（容器模式）
 */
router.get('/detect-all', async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User ID required', code: 'USER_ID_REQUIRED' });
        }

        const { getProjectsInContainer } = await import('../projects.js');
        const { detectTaskMasterFolder } = await import('../../services/projects/taskmaster/index.js');
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

// ─── 任务管理路由 ───────────────────────────────────────

/**
 * GET /api/taskmaster/next/:projectName
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

            // 回退：从本地文件查找下一个待处理任务
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
 * GET /api/taskmaster/tasks/:projectName
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

// ─── PRD 文件管理路由 ───────────────────────────────────

/**
 * GET /api/taskmaster/prd/:projectName
 * 列出项目的所有 PRD 文件
 */
router.get('/prd/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const prdFiles = await listPrdFiles(projectPath);

        res.json({
            success: true,
            data: {
                projectName,
                projectPath,
                prdFiles,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('PRD list error:', error);
        res.status(500).json({ error: 'Failed to list PRD files', message: error.message });
    }
});

/**
 * POST /api/taskmaster/prd/:projectName
 * 创建或更新 PRD 文件
 */
router.post('/prd/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { fileName, content } = req.body;

        if (!fileName || !content) {
            return res.status(400).json({ error: 'Missing required fields', message: 'fileName and content are required' });
        }

        if (!isValidPrdFileName(fileName)) {
            return res.status(400).json({
                error: 'Invalid filename',
                message: 'Filename must end with .txt or .md and contain only alphanumeric characters, spaces, dots, and dashes'
            });
        }

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const fileInfo = await writePrdFile(projectPath, fileName, content);

        res.json({
            projectName,
            projectPath,
            ...fileInfo,
            message: 'PRD file saved successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('PRD create/update error:', error);
        res.status(500).json({ error: 'Failed to create/update PRD file', message: error.message });
    }
});

/**
 * GET /api/taskmaster/prd/:projectName/:fileName
 * 获取特定 PRD 文件的内容
 */
router.get('/prd/:projectName/:fileName', async (req, res) => {
    try {
        const { projectName, fileName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const fileInfo = await readPrdFile(projectPath, fileName);

        if (!fileInfo) {
            return res.status(404).json({ error: 'PRD file not found', message: `File "${fileName}" does not exist` });
        }

        res.json({
            projectName,
            projectPath,
            ...fileInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('PRD read error:', error);
        res.status(500).json({ error: 'Failed to read PRD file', message: error.message });
    }
});

/**
 * DELETE /api/taskmaster/prd/:projectName/:fileName
 * 删除特定的 PRD 文件
 */
router.delete('/prd/:projectName/:fileName', async (req, res) => {
    try {
        const { projectName, fileName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const deleted = await deletePrdFile(projectPath, fileName);

        if (!deleted) {
            return res.status(404).json({ error: 'PRD file not found', message: `File "${fileName}" does not exist` });
        }

        res.json({
            projectName,
            projectPath,
            fileName,
            message: 'PRD file deleted successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('PRD delete error:', error);
        res.status(500).json({ error: 'Failed to delete PRD file', message: error.message });
    }
});

// ─── CLI 操作路由 ───────────────────────────────────────

/**
 * POST /api/taskmaster/initialize/:projectName
 * 占位符端点，尚未实现
 */
router.post('/initialize/:projectName', async (req, res) => {
    const { projectName } = req.params;
    res.status(501).json({
        error: 'TaskMaster initialization not yet implemented',
        message: 'This endpoint will execute task-master init via CLI in a future update',
        projectName,
        rules: req.body.rules
    });
});

/**
 * POST /api/taskmaster/init/:projectName
 * 在项目中初始化 TaskMaster
 */
router.post('/init/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        // 检查是否已初始化
        const taskMasterPath = path.join(projectPath, '.taskmaster');
        try {
            await fsPromises.access(taskMasterPath, fsConstants.F_OK);
            return res.status(400).json({
                error: 'TaskMaster already initialized',
                message: 'TaskMaster is already configured for this project'
            });
        } catch {
            // 目录不存在，可以继续
        }

        const result = await initTaskMaster(projectPath);
        broadcastProject(req, projectName, { hasTaskmaster: true, status: 'initialized' });

        res.json({
            projectName,
            projectPath,
            message: 'TaskMaster initialized successfully',
            output: result.output,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('TaskMaster init error:', error);
        res.status(500).json({ error: 'Failed to initialize TaskMaster', message: error.message });
    }
});

/**
 * POST /api/taskmaster/add-task/:projectName
 * 向项目添加新任务
 */
router.post('/add-task/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { prompt, title, description, priority = 'medium', dependencies } = req.body;

        if (!prompt && (!title || !description)) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'Either "prompt" or both "title" and "description" are required'
            });
        }

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const result = await addTaskCli(projectPath, { prompt, title, description, priority, dependencies });
        broadcastTasks(req, projectName);

        res.json({
            projectName,
            projectPath,
            message: 'Task added successfully',
            output: result.output,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Add task error:', error);
        res.status(500).json({ error: 'Failed to add task', message: error.message });
    }
});

/**
 * PUT /api/taskmaster/update-task/:projectName/:taskId
 * 更新特定任务
 */
router.put('/update-task/:projectName/:taskId', async (req, res) => {
    try {
        const { projectName, taskId } = req.params;
        const { title, description, status, priority, details } = req.body;

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        let result;

        // 如果仅更新状态，使用 set-status 命令
        if (status && Object.keys(req.body).length === 1) {
            result = await setTaskStatus(projectPath, taskId, status);
        } else {
            result = await updateTaskCli(projectPath, taskId, { title, description, priority, details });
        }

        broadcastTasks(req, projectName);

        res.json({
            projectName,
            projectPath,
            taskId,
            message: 'Task updated successfully',
            output: result.output,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task', message: error.message });
    }
});

/**
 * POST /api/taskmaster/parse-prd/:projectName
 * 解析 PRD 文件以生成任务
 */
router.post('/parse-prd/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { fileName = 'prd.txt', numTasks, append = false } = req.body;

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        // 检查 PRD 文件是否存在
        const exists = await prdFileExists(projectPath, fileName);
        if (!exists) {
            return res.status(404).json({
                error: 'PRD file not found',
                message: `File "${fileName}" does not exist in .taskmaster/docs/`
            });
        }

        const prdPath = path.join(projectPath, '.taskmaster', 'docs', fileName);
        const result = await parsePRDCli(projectPath, prdPath, { numTasks, append });
        broadcastTasks(req, projectName);

        res.json({
            projectName,
            projectPath,
            prdFile: fileName,
            message: 'PRD parsed and tasks generated successfully',
            output: result.output,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Parse PRD error:', error);
        res.status(500).json({ error: 'Failed to parse PRD', message: error.message });
    }
});

// ─── 模板路由 ───────────────────────────────────────────

/**
 * GET /api/taskmaster/prd-templates
 * 获取可用的 PRD 模板
 */
router.get('/prd-templates', async (req, res) => {
    try {
        const templates = getAvailableTemplates();
        res.json({ templates, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('PRD templates error:', error);
        res.status(500).json({ error: 'Failed to get PRD templates', message: error.message });
    }
});

/**
 * POST /api/taskmaster/apply-template/:projectName
 * 应用 PRD 模板以创建新的 PRD 文件
 */
router.post('/apply-template/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { templateId, fileName = 'prd.txt', customizations = {} } = req.body;

        if (!templateId) {
            return res.status(400).json({ error: 'Missing required parameter', message: 'templateId is required' });
        }

        const projectPath = await resolveProjectPath(projectName, res);
        if (!projectPath) return;

        const template = getTemplateById(templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found', message: `Template "${templateId}" does not exist` });
        }

        const content = applyCustomizations(template.content, customizations);
        const fileInfo = await writePrdFile(projectPath, fileName, content);

        res.json({
            projectName,
            projectPath,
            templateId,
            templateName: template.name,
            ...fileInfo,
            message: 'PRD template applied successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Apply template error:', error);
        res.status(500).json({ error: 'Failed to apply PRD template', message: error.message });
    }
});

export default router;
