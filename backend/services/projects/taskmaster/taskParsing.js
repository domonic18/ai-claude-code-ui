/**
 * Task Parsing Utilities
 *
 * 提供任务数据解析和标准化功能
 *
 * @module services/projects/taskmaster/taskParsing
 */

/**
 * 从 tasks.json 解析任务数据
 * 支持传统数组格式、带 tasks 字段的格式、带标签格式
 * @param {Object} tasksData - 原始 JSON 数据
 * @returns {{tasks: Array, currentTag: string}} 解析后的任务列表和当前标签
 */
export function parseTasksData(tasksData) {
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
export function normalizeTask(task) {
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
export function countByStatus(tasks) {
    return {
        pending: tasks.filter(t => t.status === 'pending').length,
        'in-progress': tasks.filter(t => t.status === 'in-progress').length,
        done: tasks.filter(t => t.status === 'done').length,
        review: tasks.filter(t => t.status === 'review').length,
        deferred: tasks.filter(t => t.status === 'deferred').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
}
