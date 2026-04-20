/**
 * TaskMaster 任务服务
 *
 * 负责任务数据的读取、解析和统计：
 * - 从 tasks.json 读取任务列表
 * - 处理带标签和传统两种格式
 * - 计算任务统计信息
 *
 * @module services/projects/taskmaster/task-service
 */

import path from 'path';
import { promises as fsPromises, constants as fsConstants } from 'fs';
import { createLogger } from '../../../utils/logger.js';
import { parseTasksData, normalizeTask, countByStatus } from './taskParsing.js';

const logger = createLogger('services/projects/taskmaster/task-service');

/**
 * 加载项目的任务列表
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object>} 任务数据，包含任务列表、标签和统计信息
 */
export async function loadTasks(projectPath) {
    const tasksFilePath = path.join(projectPath, '.taskmaster', 'tasks', 'tasks.json');

    // 检查任务文件是否存在
    try {
        await fsPromises.access(tasksFilePath);
    } catch {
        return {
            projectName: path.basename(projectPath),
            tasks: [],
            message: 'No tasks.json file found'
        };
    }

    const tasksContent = await fsPromises.readFile(tasksFilePath, 'utf8');
    const tasksData = JSON.parse(tasksContent);

    const { tasks, currentTag } = parseTasksData(tasksData);
    const transformedTasks = tasks.map(normalizeTask);

    return {
        projectName: path.basename(projectPath),
        projectPath,
        tasks: transformedTasks,
        currentTag,
        totalTasks: transformedTasks.length,
        tasksByStatus: countByStatus(transformedTasks),
        timestamp: new Date().toISOString()
    };
}

/**
 * 获取下一个待处理的任务
 * 从已有任务中查找状态为 pending 或 in-progress 的第一个任务
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object|null>} 下一个任务，或 null
 */
export async function findNextPendingTask(projectPath) {
    const result = await loadTasks(projectPath);

    if (!result.tasks || result.tasks.length === 0) {
        return null;
    }

    return result.tasks.find(
        task => task.status === 'pending' || task.status === 'in-progress'
    ) || null;
}
