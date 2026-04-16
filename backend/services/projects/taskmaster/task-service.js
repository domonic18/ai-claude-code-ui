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

const logger = createLogger('services/projects/taskmaster/task-service');

/**
 * 从 tasks.json 解析任务数据
 * 支持传统数组格式、带 tasks 字段的格式、带标签格式
 * @param {Object} tasksData - 原始 JSON 数据
 * @returns {{tasks: Array, currentTag: string}} 解析后的任务列表和当前标签
 */
function parseTasksData(tasksData) {
    let tasks = [];
    let currentTag = 'master';

    if (Array.isArray(tasksData)) {
        // 传统格式：直接数组
        tasks = tasksData;
    } else if (tasksData.tasks) {
        // 带有 tasks 字段的简单格式
        tasks = tasksData.tasks;
    } else {
        // 带标签格式：从当前标签或 master 获取任务
        if (tasksData[currentTag] && tasksData[currentTag].tasks) {
            tasks = tasksData[currentTag].tasks;
        } else if (tasksData.master && tasksData.master.tasks) {
            tasks = tasksData.master.tasks;
        } else {
            // 从第一个可用标签获取
            const firstTag = Object.keys(tasksData).find(
                key => tasksData[key].tasks && Array.isArray(tasksData[key].tasks)
            );
            if (firstTag) {
                tasks = tasksData[firstTag].tasks;
                currentTag = firstTag;
            }
        }
    }

    return { tasks, currentTag };
}

/**
 * 将原始任务数据转换为标准格式
 * @param {Object} task - 原始任务对象
 * @returns {Object} 标准化的任务对象
 */
function normalizeTask(task) {
    return {
        id: task.id,
        title: task.title || 'Untitled Task',
        description: task.description || '',
        status: task.status || 'pending',
        priority: task.priority || 'medium',
        dependencies: task.dependencies || [],
        createdAt: task.createdAt || task.created || new Date().toISOString(),
        updatedAt: task.updatedAt || task.updated || new Date().toISOString(),
        details: task.details || '',
        testStrategy: task.testStrategy || task.test_strategy || '',
        subtasks: task.subtasks || []
    };
}

/**
 * 按状态统计任务数量
 * @param {Array} tasks - 任务列表
 * @returns {Object} 各状态的任务数量
 */
function countByStatus(tasks) {
    return {
        pending: tasks.filter(t => t.status === 'pending').length,
        'in-progress': tasks.filter(t => t.status === 'in-progress').length,
        done: tasks.filter(t => t.status === 'done').length,
        review: tasks.filter(t => t.status === 'review').length,
        deferred: tasks.filter(t => t.status === 'deferred').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
}

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
