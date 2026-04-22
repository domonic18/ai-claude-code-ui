/**
 * TaskMaster CLI 集成服务
 *
 * 封装 TaskMaster CLI 进程管理，包括：
 * - 安装状态检测
 * - CLI 命令执行（init, add-task, update-task, parse-prd, next）
 *
 * @module services/projects/taskmaster/cli
 */

import { createLogger } from '../../../utils/logger.js';
import { executeCommand, handleTaskMasterResult, parseJSONOutput } from './taskmasterExecutor.js';
import { buildAddTaskArgs, buildUpdateTaskArgs, buildParsePRDArgs, buildSetStatusArgs } from './taskmasterCommands.js';

const logger = createLogger('services/projects/taskmaster/cli');

// 在执行 TaskMaster 命令时调用，通过 CLI 与 TaskMaster 交互
/**
 * 检查 TaskMaster CLI 是否已全局安装
 * @returns {Promise<Object>} 安装状态结果
 */
export async function checkTaskMasterInstallation() {
    try {
        const whichResult = await executeCommand('which', ['task-master'], process.cwd());

        if (whichResult.code !== 0 || !whichResult.stdout.trim()) {
            return {
                isInstalled: false,
                installPath: null,
                version: null,
                reason: 'TaskMaster CLI not found in PATH'
            };
        }

        // 已安装，获取版本
        try {
            const versionResult = await executeCommand('task-master', ['--version'], process.cwd());
            return {
                isInstalled: true,
                installPath: whichResult.stdout.trim(),
                version: versionResult.code === 0 ? versionResult.stdout.trim() : 'unknown',
                reason: null
            };
        } catch {
            return {
                isInstalled: true,
                installPath: whichResult.stdout.trim(),
                version: 'unknown',
                reason: null
            };
        }
    } catch (error) {
        return {
            isInstalled: false,
            installPath: null,
            version: null,
            reason: `Error checking installation: ${error.message}`
        };
    }
}

// 在执行 TaskMaster 命令时调用，通过 CLI 与 TaskMaster 交互
/**
 * 获取下一个推荐任务
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object|null>} 下一个任务数据，或 null
 */
export async function getNextTask(projectPath) {
  const result = await executeCommand('task-master', ['next'], projectPath);

  if (result.code !== 0) {
    throw new Error(`task-master next failed with code ${result.code}: ${result.stderr}`);
  }

  return parseJSONOutput(result.stdout);
}

// 在执行 TaskMaster 命令时调用，通过 CLI 与 TaskMaster 交互
/**
 * 在项目中初始化 TaskMaster
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string, success: boolean}>} 初始化结果
 */
export async function initTaskMaster(projectPath) {
  const result = await executeCommand('npx', ['task-master', 'init'], projectPath, {
    stdinInput: 'yes\n'
  });

  return handleTaskMasterResult(result, 'TaskMaster init');
}

// cli.js 功能函数
/**
 * 添加新任务
 * @param {string} projectPath - 项目路径
 * @param {Object} params - 任务参数
 * @param {string} [params.prompt] - AI 提示词
 * @param {string} [params.title] - 任务标题
 * @param {string} [params.description] - 任务描述
 * @param {string} [params.priority='medium'] - 优先级
 * @param {string} [params.dependencies] - 依赖
 * @returns {Promise<{output: string, success: boolean}>} 执行结果
 */
export async function addTask(projectPath, params) {
  const args = buildAddTaskArgs(params);
  const result = await executeCommand('npx', args, projectPath);

  return handleTaskMasterResult(result, 'Add task');
}

// 在执行 TaskMaster 命令时调用，通过 CLI 与 TaskMaster 交互
/**
 * 更新任务状态
 * @param {string} projectPath - 项目路径
 * @param {string} taskId - 任务 ID
 * @param {string} status - 新状态
 * @returns {Promise<{output: string, success: boolean}>} 执行结果
 */
export async function setTaskStatus(projectPath, taskId, status) {
  const args = buildSetStatusArgs(taskId, status);
  const result = await executeCommand('npx', args, projectPath);

  return handleTaskMasterResult(result, 'Set task status');
}

// cli.js 功能函数
/**
 * 更新任务详情
 * @param {string} projectPath - 项目路径
 * @param {string} taskId - 任务 ID
 * @param {Object} updates - 更新内容
 * @param {string} [updates.title] - 新标题
 * @param {string} [updates.description] - 新描述
 * @param {string} [updates.priority] - 新优先级
 * @param {string} [updates.details] - 新详情
 * @returns {Promise<{output: string, success: boolean}>} 执行结果
 */
export async function updateTask(projectPath, taskId, updates) {
  const args = buildUpdateTaskArgs(taskId, updates);
  const result = await executeCommand('npx', args, projectPath);

  return handleTaskMasterResult(result, 'Update task');
}

// cli.js 功能函数
/**
 * 解析 PRD 文件生成任务
 * @param {string} projectPath - 项目路径
 * @param {string} prdPath - PRD 文件的完整路径
 * @param {Object} [options={}] - 解析选项
 * @param {number} [options.numTasks] - 要生成的任务数量
 * @param {boolean} [options.append=false] - 是否追加到已有任务
 * @returns {Promise<{output: string, success: boolean}>} 执行结果
 */
export async function parsePRD(projectPath, prdPath, options = {}) {
  const args = buildParsePRDArgs(prdPath, options);
  const result = await executeCommand('npx', args, projectPath);

  return handleTaskMasterResult(result, 'Parse PRD');
}
