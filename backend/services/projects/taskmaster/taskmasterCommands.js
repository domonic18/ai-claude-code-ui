/**
 * TaskMaster Command Builders
 *
 * Helper functions for building TaskMaster CLI commands
 *
 * @module services/projects/taskmaster/taskmasterCommands
 */

/**
 * Build add-task arguments
 * @param {Object} params - Task parameters
 * @param {string} [params.prompt] - AI prompt
 * @param {string} [params.title] - Task title
 * @param {string} [params.description] - Task description
 * @param {string} [params.priority] - Task priority
 * @param {string} [params.dependencies] - Task dependencies
 * @returns {string[]} Command arguments
 */
export function buildAddTaskArgs(params) {
  const { prompt, title, description, priority = 'medium', dependencies } = params;
  const args = ['task-master-ai', 'add-task'];

  if (prompt) {
    args.push('--prompt', prompt, '--research');
  } else {
    args.push('--prompt', `Create a task titled "${title}" with description: ${description}`);
  }

  if (priority) {
    args.push('--priority', priority);
  }
  if (dependencies) {
    args.push('--dependencies', dependencies);
  }

  return args;
}

/**
 * Build update-task arguments
 * @param {string} taskId - Task ID
 * @param {Object} updates - Update content
 * @param {string} [updates.title] - New title
 * @param {string} [updates.description] - New description
 * @param {string} [updates.priority] - New priority
 * @param {string} [updates.details] - New details
 * @returns {string[]} Command arguments
 */
export function buildUpdateTaskArgs(taskId, updates) {
  const parts = [];
  if (updates.title) parts.push(`title: "${updates.title}"`);
  if (updates.description) parts.push(`description: "${updates.description}"`);
  if (updates.priority) parts.push(`priority: "${updates.priority}"`);
  if (updates.details) parts.push(`details: "${updates.details}"`);

  const prompt = `Update task with the following changes: ${parts.join(', ')}`;

  return [
    'task-master-ai',
    'update-task',
    `--id=${taskId}`,
    `--prompt=${prompt}`
  ];
}

/**
 * Build parse-prd arguments
 * @param {string} prdPath - PRD file path
 * @param {Object} options - Parse options
 * @param {number} [options.numTasks] - Number of tasks to generate
 * @param {boolean} [options.append] - Whether to append to existing tasks
 * @returns {string[]} Command arguments
 */
export function buildParsePRDArgs(prdPath, options = {}) {
  const args = ['task-master-ai', 'parse-prd', prdPath];

  if (options.numTasks) {
    args.push('--num-tasks', options.numTasks.toString());
  }
  if (options.append) {
    args.push('--append');
  }
  args.push('--research');

  return args;
}

/**
 * Build set-status arguments
 * @param {string} taskId - Task ID
 * @param {string} status - New status
 * @returns {string[]} Command arguments
 */
export function buildSetStatusArgs(taskId, status) {
  return [
    'task-master-ai',
    'set-status',
    `--id=${taskId}`,
    `--status=${status}`
  ];
}
