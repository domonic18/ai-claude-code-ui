/**
 * TaskMaster 文件夹检测器
 *
 * 检测并分析给定项目路径中的 TaskMaster 项目文件夹（`.taskmaster/`）。
 * 验证文件夹结构，检查关键文件（`tasks/tasks.json`、`config.json`），
 * 并计算聚合的任务统计信息（完成百分比、状态分布、子任务数）。
 *
 * ## 检测流程
 * 1. 检查项目根目录下是否存在 `.taskmaster/` 目录
 * 2. 验证关键文件是否存在（tasks/tasks.json 为必需）
 * 3. 解析 tasks.json 并计算聚合统计
 *
 * @module services/projects/taskmaster/detector
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/taskmaster/detector');

/** TaskMaster 有效安装所需的文件列表 */
const KEY_FILES = ['tasks/tasks.json', 'config.json'];

// detector.js 功能函数
/**
 * 检查目录是否存在且确实为目录
 *
 * @param {string} dirPath - 要检查的绝对路径
 * @returns {Promise<{exists: boolean, reason?: string}>} 存在性结果，附失败原因
 */
async function checkDirectoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) return { exists: false, reason: '.taskmaster exists but is not a directory' };
    return { exists: true };
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false, reason: '.taskmaster directory not found' };
    throw error;
  }
}

// detector.js 功能函数
/**
 * 验证 TaskMaster 所需的关键文件是否存在
 *
 * 仅 `tasks/tasks.json` 被视为必需文件 —— 缺失时 `hasEssentialFiles` 为 false。
 * 其他文件仅做检查但不阻塞。
 *
 * @param {string} taskMasterPath - `.taskmaster` 目录的绝对路径
 * @returns {Promise<{fileStatus: Object<string, boolean>, hasEssentialFiles: boolean}>}
 */
async function checkKeyFiles(taskMasterPath) {
  const fileStatus = {};
  let hasEssentialFiles = true;

  for (const file of KEY_FILES) {
    try {
      await fs.access(path.join(taskMasterPath, file));
      fileStatus[file] = true;
    } catch {
      fileStatus[file] = false;
      // tasks.json 是 TaskMaster 正常运行的唯一必需文件
      if (file === 'tasks/tasks.json') hasEssentialFiles = false;
    }
  }
  return { fileStatus, hasEssentialFiles };
}

// detector.js 功能函数
/**
 * 从 tasks.json 数据中提取扁平化的任务数组
 *
 * 支持两种数据格式：
 * - `{ tasks: [...] }` — 扁平结构（默认）
 * - `{ <标签>: { tasks: [...] } }` — 按标签分组结构，每个键持有独立的任务列表
 *
 * @param {Object} tasksData - 解析后的 tasks.json 内容
 * @returns {Array} 所有任务对象的扁平数组
 */
function extractAllTasks(tasksData) {
  if (tasksData.tasks) return tasksData.tasks;
  // 按标签分组格式：将所有标签下的任务合并到一个数组
  const tasks = [];
  Object.values(tasksData).forEach(tagData => {
    if (tagData.tasks) tasks.push(...tagData.tasks);
  });
  return tasks;
}

// detector.js 功能函数
/**
 * 从扁平任务数组计算聚合统计信息
 *
 * 按状态（pending、in-progress、done、review 等）统计任务数量，
 * 计算总体完成百分比，同时统计子任务数量。
 *
 * @param {Array<Object>} tasks - 任务对象数组，每个任务包含 `status` 字段
 * @param {Array} [tasks[].subtasks] - 可选的嵌套子任务数组
 * @returns {{taskCount: number, subtaskCount: number, completed: number, pending: number, inProgress: number, review: number, completionPercentage: number}}
 */
function calculateTaskStats(tasks) {
  const stats = tasks.reduce((acc, task) => {
    acc.total++;
    acc[task.status] = (acc[task.status] || 0) + 1;
    // 递归统计子任务，并单独追踪其状态分布
    if (task.subtasks) {
      task.subtasks.forEach(sub => {
        acc.subtotalTasks++;
        acc.subtasks = acc.subtasks || {};
        acc.subtasks[sub.status] = (acc.subtasks[sub.status] || 0) + 1;
      });
    }
    return acc;
  }, { total: 0, subtotalTasks: 0, pending: 0, 'in-progress': 0, done: 0, review: 0, deferred: 0, cancelled: 0, subtasks: {} });

  return {
    taskCount: stats.total,
    subtaskCount: stats.subtotalTasks,
    completed: stats.done || 0,
    pending: stats.pending || 0,
    inProgress: stats['in-progress'] || 0,
    review: stats.review || 0,
    completionPercentage: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
  };
}

// detector.js 功能函数
/**
 * 读取并解析 tasks.json，返回聚合的任务统计信息
 *
 * @param {string} taskMasterPath - `.taskmaster` 目录的绝对路径
 * @returns {Promise<Object>} 任务统计信息，解析失败时返回 `{ error: string }`
 */
async function parseTaskMetadata(taskMasterPath) {
  const tasksPath = path.join(taskMasterPath, 'tasks/tasks.json');
  try {
    const tasksData = JSON.parse(await fs.readFile(tasksPath, 'utf8'));
    const tasks = extractAllTasks(tasksData);
    const stats = calculateTaskStats(tasks);
    // 从文件 mtime 附加最后修改时间戳
    stats.lastModified = (await fs.stat(tasksPath)).mtime.toISOString();
    return stats;
  } catch (parseError) {
    logger.warn('Failed to parse tasks.json:', parseError.message);
    return { error: 'Failed to parse tasks.json' };
  }
}

// detector.js 功能函数
/**
 * 检测指定项目目录中的 TaskMaster 安装
 *
 * 执行完整的检测周期：目录检查 → 文件验证 → 元数据解析。
 * 返回结构化结果，供前端展示 TaskMaster 状态使用。
 *
 * @param {string} projectPath - 项目根目录的绝对路径
 * @returns {Promise<{hasTaskmaster: boolean, reason?: string, hasEssentialFiles?: boolean, files?: Object, metadata?: Object, path?: string}>}
 */
async function detectTaskMasterFolder(projectPath) {
  try {
    const taskMasterPath = path.join(projectPath, '.taskmaster');

    const dirCheck = await checkDirectoryExists(taskMasterPath);
    if (!dirCheck.exists) return { hasTaskmaster: false, reason: dirCheck.reason };

    const { fileStatus, hasEssentialFiles } = await checkKeyFiles(taskMasterPath);

    // 仅在关键任务文件存在时才解析元数据
    let metadata = null;
    if (fileStatus['tasks/tasks.json']) {
      metadata = await parseTaskMetadata(taskMasterPath);
    }

    return { hasTaskmaster: true, hasEssentialFiles, files: fileStatus, metadata, path: taskMasterPath };
  } catch (error) {
    logger.error('Error detecting TaskMaster folder:', error);
    return { hasTaskmaster: false, reason: `Error checking directory: ${error.message}` };
  }
}

export { detectTaskMasterFolder };
