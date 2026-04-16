/**
 * TaskMaster CLI 集成服务
 *
 * 封装 TaskMaster CLI 进程管理，包括：
 * - 安装状态检测
 * - CLI 命令执行（init, add-task, update-task, parse-prd, next）
 *
 * @module services/projects/taskmaster/cli
 */

import { spawn } from 'child_process';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/projects/taskmaster/cli');

/**
 * 执行 CLI 命令并返回结果
 * @param {string} command - 要执行的命令
 * @param {string[]} args - 命令参数
 * @param {string} cwd - 工作目录
 * @param {Object} [options={}] - 额外选项
 * @param {string} [options.stdinInput] - 需要通过 stdin 传入的数据
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} 命令执行结果
 */
function executeCommand(command, args, cwd, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({ stdout, stderr, code });
        });

        child.on('error', (error) => {
            reject(error);
        });

        if (options.stdinInput) {
            child.stdin.write(options.stdinInput);
        }
        child.stdin.end();
    });
}

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

    if (!result.stdout.trim()) {
        return null;
    }

    try {
        return JSON.parse(result.stdout);
    } catch {
        return { message: result.stdout.trim() };
    }
}

/**
 * 在项目中初始化 TaskMaster
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string, success: boolean}>} 初始化结果
 */
export async function initTaskMaster(projectPath) {
    const result = await executeCommand('npx', ['task-master', 'init'], projectPath, {
        stdinInput: 'yes\n'
    });

    if (result.code !== 0) {
        logger.error('TaskMaster init failed:', result.stderr);
        throw new Error(result.stderr || result.stdout);
    }

    return { output: result.stdout, success: true };
}

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

    const result = await executeCommand('npx', args, projectPath);

    if (result.code !== 0) {
        logger.error('Add task failed:', result.stderr);
        throw new Error(result.stderr || result.stdout);
    }

    return { output: result.stdout, success: true };
}

/**
 * 更新任务状态
 * @param {string} projectPath - 项目路径
 * @param {string} taskId - 任务 ID
 * @param {string} status - 新状态
 * @returns {Promise<{output: string, success: boolean}>} 执行结果
 */
export async function setTaskStatus(projectPath, taskId, status) {
    const result = await executeCommand(
        'npx',
        ['task-master-ai', 'set-status', `--id=${taskId}`, `--status=${status}`],
        projectPath
    );

    if (result.code !== 0) {
        logger.error('Set task status failed:', result.stderr);
        throw new Error(result.stderr || result.stdout);
    }

    return { output: result.stdout, success: true };
}

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
    const parts = [];
    if (updates.title) parts.push(`title: "${updates.title}"`);
    if (updates.description) parts.push(`description: "${updates.description}"`);
    if (updates.priority) parts.push(`priority: "${updates.priority}"`);
    if (updates.details) parts.push(`details: "${updates.details}"`);

    const prompt = `Update task with the following changes: ${parts.join(', ')}`;

    const result = await executeCommand(
        'npx',
        ['task-master-ai', 'update-task', `--id=${taskId}`, `--prompt=${prompt}`],
        projectPath
    );

    if (result.code !== 0) {
        logger.error('Update task failed:', result.stderr);
        throw new Error(result.stderr || result.stdout);
    }

    return { output: result.stdout, success: true };
}

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
    const args = ['task-master-ai', 'parse-prd', prdPath];

    if (options.numTasks) {
        args.push('--num-tasks', options.numTasks.toString());
    }
    if (options.append) {
        args.push('--append');
    }
    args.push('--research');

    const result = await executeCommand('npx', args, projectPath);

    if (result.code !== 0) {
        logger.error('Parse PRD failed:', result.stderr);
        throw new Error(result.stderr || result.stdout);
    }

    return { output: result.stdout, success: true };
}
