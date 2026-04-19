import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/taskmaster/detector');

const KEY_FILES = ['tasks/tasks.json', 'config.json'];

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

async function checkKeyFiles(taskMasterPath) {
  const fileStatus = {};
  let hasEssentialFiles = true;

  for (const file of KEY_FILES) {
    try {
      await fs.access(path.join(taskMasterPath, file));
      fileStatus[file] = true;
    } catch {
      fileStatus[file] = false;
      if (file === 'tasks/tasks.json') hasEssentialFiles = false;
    }
  }
  return { fileStatus, hasEssentialFiles };
}

function extractAllTasks(tasksData) {
  if (tasksData.tasks) return tasksData.tasks;
  const tasks = [];
  Object.values(tasksData).forEach(tagData => {
    if (tagData.tasks) tasks.push(...tagData.tasks);
  });
  return tasks;
}

function calculateTaskStats(tasks) {
  const stats = tasks.reduce((acc, task) => {
    acc.total++;
    acc[task.status] = (acc[task.status] || 0) + 1;
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

async function parseTaskMetadata(taskMasterPath) {
  const tasksPath = path.join(taskMasterPath, 'tasks/tasks.json');
  try {
    const tasksData = JSON.parse(await fs.readFile(tasksPath, 'utf8'));
    const tasks = extractAllTasks(tasksData);
    const stats = calculateTaskStats(tasks);
    stats.lastModified = (await fs.stat(tasksPath)).mtime.toISOString();
    return stats;
  } catch (parseError) {
    logger.warn('Failed to parse tasks.json:', parseError.message);
    return { error: 'Failed to parse tasks.json' };
  }
}

async function detectTaskMasterFolder(projectPath) {
  try {
    const taskMasterPath = path.join(projectPath, '.taskmaster');

    const dirCheck = await checkDirectoryExists(taskMasterPath);
    if (!dirCheck.exists) return { hasTaskmaster: false, reason: dirCheck.reason };

    const { fileStatus, hasEssentialFiles } = await checkKeyFiles(taskMasterPath);

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
