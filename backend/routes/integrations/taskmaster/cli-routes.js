/**
 * TaskMaster CLI 操作路由
 *
 * 提供 TaskMaster 初始化、任务增删改、PRD 解析等
 * 涉及 CLI 调用的 API 端点。
 *
 * 端点列表：
 * - POST /initialize/:projectName  - 占位符端点（未实现）
 * - POST /init/:projectName        - 在项目中初始化 TaskMaster
 * - POST /add-task/:projectName    - 向项目添加新任务
 * - PUT  /update-task/:projectName/:taskId - 更新特定任务
 * - POST /parse-prd/:projectName   - 解析 PRD 文件以生成任务
 *
 * @module routes/integrations/taskmaster/cli-routes
 */

import express from 'express';
import path from 'path';
import { promises as fsPromises, constants as fsConstants } from 'fs';
import { createLogger } from '../../../utils/logger.js';
import {
    initTaskMaster,
    addTask as addTaskCli,
    setTaskStatus,
    updateTask as updateTaskCli,
    parsePRD as parsePRDCli,
    prdFileExists,
} from '../../../services/projects/taskmaster/index.js';
import {
    resolveProjectPath,
    broadcastTasks,
    broadcastProject,
} from './task-helpers.js';

const logger = createLogger('routes/integrations/taskmaster/cli-routes');
const router = express.Router();

/**
 * POST /initialize/:projectName
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
 * POST /init/:projectName
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
 * POST /add-task/:projectName
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
 * PUT /update-task/:projectName/:taskId
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
 * POST /parse-prd/:projectName
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

export default router;
