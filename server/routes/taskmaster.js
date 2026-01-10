/**
 * TASKMASTER API 路由
 * ====================
 *
 * 本模块提供 TaskMaster 集成的 API 端点，包括：
 * - 项目目录中的 .taskmaster 文件夹检测
 * - MCP 服务器配置检测
 * - TaskMaster 状态和元数据管理
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';
import { extractProjectDirectory } from '../services/project/index.js';
import { detectTaskMasterMCPServer } from '../utils/mcp-detector.js';
import { broadcastTaskMasterProjectUpdate, broadcastTaskMasterTasksUpdate } from '../utils/taskmaster-websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/**
 * 检查 TaskMaster CLI 是否已全局安装
 * @returns {Promise<Object>} 安装状态结果
 */
async function checkTaskMasterInstallation() {
    return new Promise((resolve) => {
        // 检查 task-master 命令是否可用
        const child = spawn('which', ['task-master'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true
        });

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0 && output.trim()) {
                // TaskMaster 已安装，获取版本
                const versionChild = spawn('task-master', ['--version'], {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    shell: true
                });

                let versionOutput = '';

                versionChild.stdout.on('data', (data) => {
                    versionOutput += data.toString();
                });

                versionChild.on('close', (versionCode) => {
                    resolve({
                        isInstalled: true,
                        installPath: output.trim(),
                        version: versionCode === 0 ? versionOutput.trim() : 'unknown',
                        reason: null
                    });
                });

                versionChild.on('error', () => {
                    resolve({
                        isInstalled: true,
                        installPath: output.trim(),
                        version: 'unknown',
                        reason: null
                    });
                });
            } else {
                resolve({
                    isInstalled: false,
                    installPath: null,
                    version: null,
                    reason: 'TaskMaster CLI not found in PATH'
                });
            }
        });

        child.on('error', (error) => {
            resolve({
                isInstalled: false,
                installPath: null,
                version: null,
                reason: `Error checking installation: ${error.message}`
            });
        });
    });
}

/**
 * 检测给定项目目录中是否存在 .taskmaster 文件夹
 * @param {string} projectPath - 项目目录的绝对路径
 * @returns {Promise<Object>} 包含状态和元数据的检测结果
 */
async function detectTaskMasterFolder(projectPath) {
    try {
        const taskMasterPath = path.join(projectPath, '.taskmaster');

        // 检查 .taskmaster 目录是否存在
        try {
            const stats = await fsPromises.stat(taskMasterPath);
            if (!stats.isDirectory()) {
                return {
                    hasTaskmaster: false,
                    reason: '.taskmaster exists but is not a directory'
                };
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    hasTaskmaster: false,
                    reason: '.taskmaster directory not found'
                };
            }
            throw error;
        }

        // 检查关键的 TaskMaster 文件
        const keyFiles = [
            'tasks/tasks.json',
            'config.json'
        ];

        const fileStatus = {};
        let hasEssentialFiles = true;

        for (const file of keyFiles) {
            const filePath = path.join(taskMasterPath, file);
            try {
                await fsPromises.access(filePath, fs.constants.R_OK);
                fileStatus[file] = true;
            } catch (error) {
                fileStatus[file] = false;
                if (file === 'tasks/tasks.json') {
                    hasEssentialFiles = false;
                }
            }
        }

        // 如果 tasks.json 存在，则解析它以获取元数据
        let taskMetadata = null;
        if (fileStatus['tasks/tasks.json']) {
            try {
                const tasksPath = path.join(taskMasterPath, 'tasks/tasks.json');
                const tasksContent = await fsPromises.readFile(tasksPath, 'utf8');
                const tasksData = JSON.parse(tasksContent);

                // 处理带标签和传统格式
                let tasks = [];
                if (tasksData.tasks) {
                    // 传统格式
                    tasks = tasksData.tasks;
                } else {
                    // 带标签格式 - 从所有标签中获取任务
                    Object.values(tasksData).forEach(tagData => {
                        if (tagData.tasks) {
                            tasks = tasks.concat(tagData.tasks);
                        }
                    });
                }

                // 计算任务统计信息
                const stats = tasks.reduce((acc, task) => {
                    acc.total++;
                    acc[task.status] = (acc[task.status] || 0) + 1;

                    // 计算子任务
                    if (task.subtasks) {
                        task.subtasks.forEach(subtask => {
                            acc.subtotalTasks++;
                            acc.subtasks = acc.subtasks || {};
                            acc.subtasks[subtask.status] = (acc.subtasks[subtask.status] || 0) + 1;
                        });
                    }

                    return acc;
                }, {
                    total: 0,
                    subtotalTasks: 0,
                    pending: 0,
                    'in-progress': 0,
                    done: 0,
                    review: 0,
                    deferred: 0,
                    cancelled: 0,
                    subtasks: {}
                });

                taskMetadata = {
                    taskCount: stats.total,
                    subtaskCount: stats.subtotalTasks,
                    completed: stats.done || 0,
                    pending: stats.pending || 0,
                    inProgress: stats['in-progress'] || 0,
                    review: stats.review || 0,
                    completionPercentage: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
                    lastModified: (await fsPromises.stat(tasksPath)).mtime.toISOString()
                };
            } catch (parseError) {
                console.warn('Failed to parse tasks.json:', parseError.message);
                taskMetadata = { error: 'Failed to parse tasks.json' };
            }
        }

        return {
            hasTaskmaster: true,
            hasEssentialFiles,
            files: fileStatus,
            metadata: taskMetadata,
            path: taskMasterPath
        };

    } catch (error) {
        console.error('Error detecting TaskMaster folder:', error);
        return {
            hasTaskmaster: false,
            reason: `Error checking directory: ${error.message}`
        };
    }
}

// MCP 检测现在由集中式工具处理

// API 路由

/**
 * GET /api/taskmaster/installation-status
 * 检查系统上是否已安装 TaskMaster CLI
 */
router.get('/installation-status', async (req, res) => {
    try {
        const installationStatus = await checkTaskMasterInstallation();

        // 同时检查 MCP 服务器配置
        const mcpStatus = await detectTaskMasterMCPServer();

        res.json({
            success: true,
            installation: installationStatus,
            mcpServer: mcpStatus,
            isReady: installationStatus.isInstalled && mcpStatus.hasMCPServer
        });
    } catch (error) {
        console.error('Error checking TaskMaster installation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check TaskMaster installation status',
            installation: {
                isInstalled: false,
                reason: `Server error: ${error.message}`
            },
            mcpServer: {
                hasMCPServer: false,
                reason: `Server error: ${error.message}`
            },
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

        // 使用现有的 extractProjectDirectory 函数获取实际项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            console.error('Error extracting project directory:', error);
            return res.status(404).json({
                error: 'Project path not found',
                projectName,
                message: error.message
            });
        }

        // 验证项目路径是否存在
        try {
            await fsPromises.access(projectPath, fs.constants.R_OK);
        } catch (error) {
            return res.status(404).json({
                error: 'Project path not accessible',
                projectPath,
                projectName,
                message: error.message
            });
        }

        // 并行运行检测
        const [taskMasterResult, mcpResult] = await Promise.all([
            detectTaskMasterFolder(projectPath),
            detectTaskMasterMCPServer()
        ]);

        // 确定总体状态
        let status = 'not-configured';
        if (taskMasterResult.hasTaskmaster && taskMasterResult.hasEssentialFiles) {
            if (mcpResult.hasMCPServer && mcpResult.isConfigured) {
                status = 'fully-configured';
            } else {
                status = 'taskmaster-only';
            }
        } else if (mcpResult.hasMCPServer && mcpResult.isConfigured) {
            status = 'mcp-only';
        }

        const responseData = {
            projectName,
            projectPath,
            status,
            taskmaster: taskMasterResult,
            mcp: mcpResult,
            timestamp: new Date().toISOString()
        };

        res.json(responseData);

    } catch (error) {
        console.error('TaskMaster detection error:', error);
        res.status(500).json({
            error: 'Failed to detect TaskMaster configuration',
            message: error.message
        });
    }
});

/**
 * GET /api/taskmaster/detect-all
 * 检测所有已知项目的 TaskMaster 配置
 * 此端点与现有的项目系统一起工作
 */
router.get('/detect-all', async (req, res) => {
    try {
        // 从项目模块导入 getProjects
        const { getProjects } = await import('../projects.js');
        const projects = await getProjects();

        // 并行运行所有项目的检测
        const detectionPromises = projects.map(async (project) => {
            try {
                // 如果可用，使用项目的 fullPath，否则提取目录
                let projectPath;
                if (project.fullPath) {
                    projectPath = project.fullPath;
                } else {
                    try {
                        projectPath = await extractProjectDirectory(project.name);
                    } catch (error) {
                        throw new Error(`Failed to extract project directory: ${error.message}`);
                    }
                }

                const [taskMasterResult, mcpResult] = await Promise.all([
                    detectTaskMasterFolder(projectPath),
                    detectTaskMasterMCPServer()
                ]);

                // 确定状态
                let status = 'not-configured';
                if (taskMasterResult.hasTaskmaster && taskMasterResult.hasEssentialFiles) {
                    if (mcpResult.hasMCPServer && mcpResult.isConfigured) {
                        status = 'fully-configured';
                    } else {
                        status = 'taskmaster-only';
                    }
                } else if (mcpResult.hasMCPServer && mcpResult.isConfigured) {
                    status = 'mcp-only';
                }

                return {
                    projectName: project.name,
                    displayName: project.displayName,
                    projectPath,
                    status,
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
        });

        const results = await Promise.all(detectionPromises);

        res.json({
            projects: results,
            summary: {
                total: results.length,
                fullyConfigured: results.filter(p => p.status === 'fully-configured').length,
                taskmasterOnly: results.filter(p => p.status === 'taskmaster-only').length,
                mcpOnly: results.filter(p => p.status === 'mcp-only').length,
                notConfigured: results.filter(p => p.status === 'not-configured').length,
                errors: results.filter(p => p.status === 'error').length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Bulk TaskMaster detection error:', error);
        res.status(500).json({
            error: 'Failed to detect TaskMaster configuration for projects',
            message: error.message
        });
    }
});

/**
 * POST /api/taskmaster/initialize/:projectName
 * 在项目中初始化 TaskMaster（未来 CLI 集成的占位符）
 */
router.post('/initialize/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { rules } = req.body; // 可选的规则配置文件

        // 这将在以后的子任务中通过 CLI 集成实现
        res.status(501).json({
            error: 'TaskMaster initialization not yet implemented',
            message: 'This endpoint will execute task-master init via CLI in a future update',
            projectName,
            rules
        });

    } catch (error) {
        console.error('TaskMaster initialization error:', error);
        res.status(500).json({
            error: 'Failed to initialize TaskMaster',
            message: error.message
        });
    }
});

/**
 * GET /api/taskmaster/next/:projectName
 * 使用 task-master CLI 获取下一个推荐任务
 */
router.get('/next/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        // 尝试执行 task-master next 命令
        try {
            const { spawn } = await import('child_process');

            const nextTaskCommand = spawn('task-master', ['next'], {
                cwd: projectPath,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            nextTaskCommand.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            nextTaskCommand.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            await new Promise((resolve, reject) => {
                nextTaskCommand.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`task-master next failed with code ${code}: ${stderr}`));
                    }
                });

                nextTaskCommand.on('error', (error) => {
                    reject(error);
                });
            });

            // 解析输出 - task-master next 通常返回 JSON
            let nextTaskData = null;
            if (stdout.trim()) {
                try {
                    nextTaskData = JSON.parse(stdout);
                } catch (parseError) {
                    // 如果不是 JSON，则视为纯文本
                    nextTaskData = { message: stdout.trim() };
                }
            }

            res.json({
                projectName,
                projectPath,
                nextTask: nextTaskData,
                timestamp: new Date().toISOString()
            });

        } catch (cliError) {
            console.warn('Failed to execute task-master CLI:', cliError.message);

            // 回退到本地加载任务并查找下一个任务
            // 使用 localhost 绕过代理进行内部服务器到服务器的调用
            const tasksResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/taskmaster/tasks/${encodeURIComponent(projectName)}`, {
                headers: {
                    'Authorization': req.headers.authorization
                }
            });

            if (tasksResponse.ok) {
                const tasksData = await tasksResponse.json();
                const nextTask = tasksData.tasks?.find(task =>
                    task.status === 'pending' || task.status === 'in-progress'
                ) || null;

                res.json({
                    projectName,
                    projectPath,
                    nextTask,
                    fallback: true,
                    message: 'Used fallback method (CLI not available)',
                    timestamp: new Date().toISOString()
                });
            } else {
                throw new Error('Failed to load tasks via fallback method');
            }
        }

    } catch (error) {
        console.error('TaskMaster next task error:', error);
        res.status(500).json({
            error: 'Failed to get next task',
            message: error.message
        });
    }
});

/**
 * GET /api/taskmaster/tasks/:projectName
 * 从 .taskmaster/tasks/tasks.json 加载实际任务
 */
router.get('/tasks/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        const taskMasterPath = path.join(projectPath, '.taskmaster');
        const tasksFilePath = path.join(taskMasterPath, 'tasks', 'tasks.json');

        // 检查任务文件是否存在
        try {
            await fsPromises.access(tasksFilePath);
        } catch (error) {
            return res.json({
                projectName,
                tasks: [],
                message: 'No tasks.json file found'
            });
        }

        // 读取并解析任务文件
        try {
            const tasksContent = await fsPromises.readFile(tasksFilePath, 'utf8');
            const tasksData = JSON.parse(tasksContent);

            let tasks = [];
            let currentTag = 'master';

            // 处理带标签和传统格式
            if (Array.isArray(tasksData)) {
                // 传统格式
                tasks = tasksData;
            } else if (tasksData.tasks) {
                // 带有任务数组的简单格式
                tasks = tasksData.tasks;
            } else {
                // 带标签格式 - 从当前标签或 master 获取任务
                if (tasksData[currentTag] && tasksData[currentTag].tasks) {
                    tasks = tasksData[currentTag].tasks;
                } else if (tasksData.master && tasksData.master.tasks) {
                    tasks = tasksData.master.tasks;
                } else {
                    // 从第一个可用标签获取任务
                    const firstTag = Object.keys(tasksData).find(key =>
                        tasksData[key].tasks && Array.isArray(tasksData[key].tasks)
                    );
                    if (firstTag) {
                        tasks = tasksData[firstTag].tasks;
                        currentTag = firstTag;
                    }
                }
            }

            // 转换任务以确保所有任务都有必填字段
            const transformedTasks = tasks.map(task => ({
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
            }));

            res.json({
                projectName,
                projectPath,
                tasks: transformedTasks,
                currentTag,
                totalTasks: transformedTasks.length,
                tasksByStatus: {
                    pending: transformedTasks.filter(t => t.status === 'pending').length,
                    'in-progress': transformedTasks.filter(t => t.status === 'in-progress').length,
                    done: transformedTasks.filter(t => t.status === 'done').length,
                    review: transformedTasks.filter(t => t.status === 'review').length,
                    deferred: transformedTasks.filter(t => t.status === 'deferred').length,
                    cancelled: transformedTasks.filter(t => t.status === 'cancelled').length
                },
                timestamp: new Date().toISOString()
            });

        } catch (parseError) {
            console.error('Failed to parse tasks.json:', parseError);
            return res.status(500).json({
                error: 'Failed to parse tasks file',
                message: parseError.message
            });
        }

    } catch (error) {
        console.error('TaskMaster tasks loading error:', error);
        res.status(500).json({
            error: 'Failed to load TaskMaster tasks',
            message: error.message
        });
    }
});

/**
 * GET /api/taskmaster/prd/:projectName
 * 列出项目的 .taskmaster/docs 目录中的所有 PRD 文件
 */
router.get('/prd/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        const docsPath = path.join(projectPath, '.taskmaster', 'docs');

        // 检查文档目录是否存在
        try {
            await fsPromises.access(docsPath, fs.constants.R_OK);
        } catch (error) {
            return res.json({
                projectName,
                prdFiles: [],
                message: 'No .taskmaster/docs directory found'
            });
        }

        // 读取目录并过滤 PRD 文件
        try {
            const files = await fsPromises.readdir(docsPath);
            const prdFiles = [];

            for (const file of files) {
                const filePath = path.join(docsPath, file);
                const stats = await fsPromises.stat(filePath);

                if (stats.isFile() && (file.endsWith('.txt') || file.endsWith('.md'))) {
                    prdFiles.push({
                        name: file,
                        path: path.relative(projectPath, filePath),
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        created: stats.birthtime.toISOString()
                    });
                }
            }

            res.json({
                projectName,
                projectPath,
                prdFiles: prdFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified)),
                timestamp: new Date().toISOString()
            });

        } catch (readError) {
            console.error('Error reading docs directory:', readError);
            return res.status(500).json({
                error: 'Failed to read PRD files',
                message: readError.message
            });
        }

    } catch (error) {
        console.error('PRD list error:', error);
        res.status(500).json({
            error: 'Failed to list PRD files',
            message: error.message
        });
    }
});

/**
 * POST /api/taskmaster/prd/:projectName
 * 在项目的 .taskmaster/docs 目录中创建或更新 PRD 文件
 */
router.post('/prd/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { fileName, content } = req.body;

        if (!fileName || !content) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'fileName and content are required'
            });
        }

        // 验证文件名
        if (!fileName.match(/^[\w\-. ]+\.(txt|md)$/)) {
            return res.status(400).json({
                error: 'Invalid filename',
                message: 'Filename must end with .txt or .md and contain only alphanumeric characters, spaces, dots, and dashes'
            });
        }

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        const docsPath = path.join(projectPath, '.taskmaster', 'docs');
        const filePath = path.join(docsPath, fileName);

        // 确保文档目录存在
        try {
            await fsPromises.mkdir(docsPath, { recursive: true });
        } catch (error) {
            console.error('Failed to create docs directory:', error);
            return res.status(500).json({
                error: 'Failed to create directory',
                message: error.message
            });
        }

        // 写入 PRD 文件
        try {
            await fsPromises.writeFile(filePath, content, 'utf8');

            // 获取文件统计信息
            const stats = await fsPromises.stat(filePath);

            res.json({
                projectName,
                projectPath,
                fileName,
                filePath: path.relative(projectPath, filePath),
                size: stats.size,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
                message: 'PRD file saved successfully',
                timestamp: new Date().toISOString()
            });

        } catch (writeError) {
            console.error('Failed to write PRD file:', writeError);
            return res.status(500).json({
                error: 'Failed to write PRD file',
                message: writeError.message
            });
        }

    } catch (error) {
        console.error('PRD create/update error:', error);
        res.status(500).json({
            error: 'Failed to create/update PRD file',
            message: error.message
        });
    }
});

/**
 * GET /api/taskmaster/prd/:projectName/:fileName
 * 获取特定 PRD 文件的内容
 */
router.get('/prd/:projectName/:fileName', async (req, res) => {
    try {
        const { projectName, fileName } = req.params;

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        const filePath = path.join(projectPath, '.taskmaster', 'docs', fileName);

        // 检查文件是否存在
        try {
            await fsPromises.access(filePath, fs.constants.R_OK);
        } catch (error) {
            return res.status(404).json({
                error: 'PRD file not found',
                message: `File "${fileName}" does not exist`
            });
        }

        // 读取文件内容
        try {
            const content = await fsPromises.readFile(filePath, 'utf8');
            const stats = await fsPromises.stat(filePath);

            res.json({
                projectName,
                projectPath,
                fileName,
                filePath: path.relative(projectPath, filePath),
                content,
                size: stats.size,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
                timestamp: new Date().toISOString()
            });

        } catch (readError) {
            console.error('Failed to read PRD file:', readError);
            return res.status(500).json({
                error: 'Failed to read PRD file',
                message: readError.message
            });
        }

    } catch (error) {
        console.error('PRD read error:', error);
        res.status(500).json({
            error: 'Failed to read PRD file',
            message: error.message
        });
    }
});

/**
 * DELETE /api/taskmaster/prd/:projectName/:fileName
 * 删除特定的 PRD 文件
 */
router.delete('/prd/:projectName/:fileName', async (req, res) => {
    try {
        const { projectName, fileName } = req.params;

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        const filePath = path.join(projectPath, '.taskmaster', 'docs', fileName);

        // 检查文件是否存在
        try {
            await fsPromises.access(filePath, fs.constants.F_OK);
        } catch (error) {
            return res.status(404).json({
                error: 'PRD file not found',
                message: `File "${fileName}" does not exist`
            });
        }

        // 删除文件
        try {
            await fsPromises.unlink(filePath);

            res.json({
                projectName,
                projectPath,
                fileName,
                message: 'PRD file deleted successfully',
                timestamp: new Date().toISOString()
            });

        } catch (deleteError) {
            console.error('Failed to delete PRD file:', deleteError);
            return res.status(500).json({
                error: 'Failed to delete PRD file',
                message: deleteError.message
            });
        }

    } catch (error) {
        console.error('PRD delete error:', error);
        res.status(500).json({
            error: 'Failed to delete PRD file',
            message: error.message
        });
    }
});

/**
 * POST /api/taskmaster/init/:projectName
 * 在项目中初始化 TaskMaster
 */
router.post('/init/:projectName', async (req, res) => {
    try {
        const { projectName } = req.params;

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        // 检查 TaskMaster 是否已初始化
        const taskMasterPath = path.join(projectPath, '.taskmaster');
        try {
            await fsPromises.access(taskMasterPath, fs.constants.F_OK);
            return res.status(400).json({
                error: 'TaskMaster already initialized',
                message: 'TaskMaster is already configured for this project'
            });
        } catch (error) {
            // 目录不存在，我们可以继续
        }

        // 运行 taskmaster init 命令
        const initProcess = spawn('npx', ['task-master', 'init'], {
            cwd: projectPath,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        initProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        initProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        initProcess.on('close', (code) => {
            if (code === 0) {
                // 通过 WebSocket 广播 TaskMaster 项目更新
                if (req.app.locals.wss) {
                    broadcastTaskMasterProjectUpdate(
                        req.app.locals.wss,
                        projectName,
                        { hasTaskmaster: true, status: 'initialized' }
                    );
                }

                res.json({
                    projectName,
                    projectPath,
                    message: 'TaskMaster initialized successfully',
                    output: stdout,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.error('TaskMaster init failed:', stderr);
                res.status(500).json({
                    error: 'Failed to initialize TaskMaster',
                    message: stderr || stdout,
                    code
                });
            }
        });

        // 向自动提示发送 'yes' 响应
        initProcess.stdin.write('yes\n');
        initProcess.stdin.end();

    } catch (error) {
        console.error('TaskMaster init error:', error);
        res.status(500).json({
            error: 'Failed to initialize TaskMaster',
            message: error.message
        });
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

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        // 构建 task-master add-task 命令
        const args = ['task-master-ai', 'add-task'];

        if (prompt) {
            args.push('--prompt', prompt);
            args.push('--research'); // 使用研究为 AI 生成的任务
        } else {
            args.push('--prompt', `Create a task titled "${title}" with description: ${description}`);
        }

        if (priority) {
            args.push('--priority', priority);
        }

        if (dependencies) {
            args.push('--dependencies', dependencies);
        }

        // 运行 task-master add-task 命令
        const addTaskProcess = spawn('npx', args, {
            cwd: projectPath,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        addTaskProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        addTaskProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        addTaskProcess.on('close', (code) => {
            console.log('Add task process completed with code:', code);
            console.log('Stdout:', stdout);
            console.log('Stderr:', stderr);

            if (code === 0) {
                // 通过 WebSocket 广播任务更新
                if (req.app.locals.wss) {
                    broadcastTaskMasterTasksUpdate(
                        req.app.locals.wss,
                        projectName
                    );
                }

                res.json({
                    projectName,
                    projectPath,
                    message: 'Task added successfully',
                    output: stdout,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.error('Add task failed:', stderr);
                res.status(500).json({
                    error: 'Failed to add task',
                    message: stderr || stdout,
                    code
                });
            }
        });

        addTaskProcess.stdin.end();

    } catch (error) {
        console.error('Add task error:', error);
        res.status(500).json({
            error: 'Failed to add task',
            message: error.message
        });
    }
});

/**
 * PUT /api/taskmaster/update-task/:projectName/:taskId
 * 使用 TaskMaster CLI 更新特定任务
 */
router.put('/update-task/:projectName/:taskId', async (req, res) => {
    try {
        const { projectName, taskId } = req.params;
        const { title, description, status, priority, details } = req.body;

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        // 如果仅更新状态，使用 set-status 命令
        if (status && Object.keys(req.body).length === 1) {
            const setStatusProcess = spawn('npx', ['task-master-ai', 'set-status', `--id=${taskId}`, `--status=${status}`], {
                cwd: projectPath,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            setStatusProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            setStatusProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            setStatusProcess.on('close', (code) => {
                if (code === 0) {
                    // 通过 WebSocket 广播任务更新
                    if (req.app.locals.wss) {
                        broadcastTaskMasterTasksUpdate(req.app.locals.wss, projectName);
                    }

                    res.json({
                        projectName,
                        projectPath,
                        taskId,
                        message: 'Task status updated successfully',
                        output: stdout,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    console.error('Set task status failed:', stderr);
                    res.status(500).json({
                        error: 'Failed to update task status',
                        message: stderr || stdout,
                        code
                    });
                }
            });

            setStatusProcess.stdin.end();
        } else {
            // 对于其他更新，使用 update-task 命令和描述更改的提示
            const updates = [];
            if (title) updates.push(`title: "${title}"`);
            if (description) updates.push(`description: "${description}"`);
            if (priority) updates.push(`priority: "${priority}"`);
            if (details) updates.push(`details: "${details}"`);

            const prompt = `Update task with the following changes: ${updates.join(', ')}`;

            const updateProcess = spawn('npx', ['task-master-ai', 'update-task', `--id=${taskId}`, `--prompt=${prompt}`], {
                cwd: projectPath,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            updateProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            updateProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            updateProcess.on('close', (code) => {
                if (code === 0) {
                    // 通过 WebSocket 广播任务更新
                    if (req.app.locals.wss) {
                        broadcastTaskMasterTasksUpdate(req.app.locals.wss, projectName);
                    }

                    res.json({
                        projectName,
                        projectPath,
                        taskId,
                        message: 'Task updated successfully',
                        output: stdout,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    console.error('Update task failed:', stderr);
                    res.status(500).json({
                        error: 'Failed to update task',
                        message: stderr || stdout,
                        code
                    });
                }
            });

            updateProcess.stdin.end();
        }

    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({
            error: 'Failed to update task',
            message: error.message
        });
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

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        const prdPath = path.join(projectPath, '.taskmaster', 'docs', fileName);

        // 检查 PRD 文件是否存在
        try {
            await fsPromises.access(prdPath, fs.constants.F_OK);
        } catch (error) {
            return res.status(404).json({
                error: 'PRD file not found',
                message: `File "${fileName}" does not exist in .taskmaster/docs/`
            });
        }

        // 构建命令参数
        const args = ['task-master-ai', 'parse-prd', prdPath];

        if (numTasks) {
            args.push('--num-tasks', numTasks.toString());
        }

        if (append) {
            args.push('--append');
        }

        args.push('--research'); // 使用研究以获得更好的 PRD 解析

        // 运行 task-master parse-prd 命令
        const parsePRDProcess = spawn('npx', args, {
            cwd: projectPath,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        parsePRDProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        parsePRDProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        parsePRDProcess.on('close', (code) => {
            if (code === 0) {
                // 通过 WebSocket 广播任务更新
                if (req.app.locals.wss) {
                    broadcastTaskMasterTasksUpdate(
                        req.app.locals.wss,
                        projectName
                    );
                }

                res.json({
                    projectName,
                    projectPath,
                    prdFile: fileName,
                    message: 'PRD parsed and tasks generated successfully',
                    output: stdout,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.error('Parse PRD failed:', stderr);
                res.status(500).json({
                    error: 'Failed to parse PRD',
                    message: stderr || stdout,
                    code
                });
            }
        });

        parsePRDProcess.stdin.end();

    } catch (error) {
        console.error('Parse PRD error:', error);
        res.status(500).json({
            error: 'Failed to parse PRD',
            message: error.message
        });
    }
});

/**
 * GET /api/taskmaster/prd-templates
 * 获取可用的 PRD 模板
 */
router.get('/prd-templates', async (req, res) => {
    try {
        // 返回内置模板
        const templates = [
            {
                id: 'web-app',
                name: 'Web Application',
                description: 'Template for web application projects with frontend and backend components',
                category: 'web',
                content: `# Product Requirements Document - Web Application

## Overview
**Product Name:** [Your App Name]
**Version:** 1.0
**Date:** ${new Date().toISOString().split('T')[0]}
**Author:** [Your Name]

## Executive Summary
Brief description of what this web application will do and why it's needed.

## Product Goals
- Goal 1: [Specific measurable goal]
- Goal 2: [Specific measurable goal]
- Goal 3: [Specific measurable goal]

## User Stories
### Core Features
1. **User Registration & Authentication**
   - As a user, I want to create an account so I can access personalized features
   - As a user, I want to log in securely so my data is protected
   - As a user, I want to reset my password if I forget it

2. **Main Application Features**
   - As a user, I want to [core feature 1] so I can [benefit]
   - As a user, I want to [core feature 2] so I can [benefit]
   - As a user, I want to [core feature 3] so I can [benefit]

3. **User Interface**
   - As a user, I want a responsive design so I can use the app on any device
   - As a user, I want intuitive navigation so I can easily find features

## Technical Requirements
### Frontend
- Framework: React/Vue/Angular or vanilla JavaScript
- Styling: CSS framework (Tailwind, Bootstrap, etc.)
- State Management: Redux/Vuex/Context API
- Build Tools: Webpack/Vite
- Testing: Jest/Vitest for unit tests

### Backend
- Runtime: Node.js/Python/Java
- Database: PostgreSQL/MySQL/MongoDB
- API: RESTful API or GraphQL
- Authentication: JWT tokens
- Testing: Integration and unit tests

### Infrastructure
- Hosting: Cloud provider (AWS, Azure, GCP)
- CI/CD: GitHub Actions/GitLab CI
- Monitoring: Application monitoring tools
- Security: HTTPS, input validation, rate limiting

## Success Metrics
- User engagement metrics
- Performance benchmarks (load time < 2s)
- Error rates < 1%
- User satisfaction scores

## Timeline
- Phase 1: Core functionality (4-6 weeks)
- Phase 2: Advanced features (2-4 weeks)
- Phase 3: Polish and launch (2 weeks)

## Constraints & Assumptions
- Budget constraints
- Technical limitations
- Team size and expertise
- Timeline constraints`
            },
            {
                id: 'api',
                name: 'REST API',
                description: 'Template for REST API development projects',
                category: 'backend',
                content: `# Product Requirements Document - REST API

## Overview
**API Name:** [Your API Name]
**Version:** v1.0
**Date:** ${new Date().toISOString().split('T')[0]}
**Author:** [Your Name]

## Executive Summary
Description of the API's purpose, target users, and primary use cases.

## API Goals
- Goal 1: Provide secure data access
- Goal 2: Ensure scalable architecture
- Goal 3: Maintain high availability (99.9% uptime)

## Functional Requirements
### Core Endpoints
1. **Authentication Endpoints**
   - POST /api/auth/login - User authentication
   - POST /api/auth/logout - User logout
   - POST /api/auth/refresh - Token refresh
   - POST /api/auth/register - User registration

2. **Data Management Endpoints**
   - GET /api/resources - List resources with pagination
   - GET /api/resources/{id} - Get specific resource
   - POST /api/resources - Create new resource
   - PUT /api/resources/{id} - Update existing resource
   - DELETE /api/resources/{id} - Delete resource

3. **Administrative Endpoints**
   - GET /api/admin/users - Manage users (admin only)
   - GET /api/admin/analytics - System analytics
   - POST /api/admin/backup - Trigger system backup

## Technical Requirements
### API Design
- RESTful architecture following OpenAPI 3.0 specification
- JSON request/response format
- Consistent error response format
- API versioning strategy

### Authentication & Security
- JWT token-based authentication
- Role-based access control (RBAC)
- Rate limiting (100 requests/minute per user)
- Input validation and sanitization
- HTTPS enforcement

### Database
- Database type: [PostgreSQL/MongoDB/MySQL]
- Connection pooling
- Database migrations
- Backup and recovery procedures

### Performance Requirements
- Response time: < 200ms for 95% of requests
- Throughput: 1000+ requests/second
- Concurrent users: 10,000+
- Database query optimization

### Documentation
- Auto-generated API documentation (Swagger/OpenAPI)
- Code examples for common use cases
- SDK development for major languages
- Postman collection for testing

## Error Handling
- Standardized error codes and messages
- Proper HTTP status codes
- Detailed error logging
- Graceful degradation strategies

## Testing Strategy
- Unit tests (80%+ coverage)
- Integration tests for all endpoints
- Load testing and performance testing
- Security testing (OWASP compliance)

## Monitoring & Logging
- Application performance monitoring
- Error tracking and alerting
- Access logs and audit trails
- Health check endpoints

## Deployment
- Containerized deployment (Docker)
- CI/CD pipeline setup
- Environment management (dev, staging, prod)
- Blue-green deployment strategy

## Success Metrics
- API uptime > 99.9%
- Average response time < 200ms
- Zero critical security vulnerabilities
- Developer adoption metrics`
            },
            {
                id: 'mobile-app',
                name: 'Mobile Application',
                description: 'Template for mobile app development projects (iOS/Android)',
                category: 'mobile',
                content: `# Product Requirements Document - Mobile Application

## Overview
**App Name:** [Your App Name]
**Platform:** iOS / Android / Cross-platform
**Version:** 1.0
**Date:** ${new Date().toISOString().split('T')[0]}
**Author:** [Your Name]

## Executive Summary
Brief description of the mobile app's purpose, target audience, and key value proposition.

## Product Goals
- Goal 1: [Specific user engagement goal]
- Goal 2: [Specific functionality goal]
- Goal 3: [Specific performance goal]

## User Stories
### Core Features
1. **Onboarding & Authentication**
   - As a new user, I want a simple onboarding process
   - As a user, I want to sign up with email or social media
   - As a user, I want biometric authentication for security

2. **Main App Features**
   - As a user, I want [core feature 1] accessible from home screen
   - As a user, I want [core feature 2] to work offline
   - As a user, I want to sync data across devices

3. **User Experience**
   - As a user, I want intuitive navigation patterns
   - As a user, I want fast loading times
   - As a user, I want accessibility features

## Technical Requirements
### Mobile Development
- **Cross-platform:** React Native / Flutter / Xamarin
- **Native:** Swift (iOS) / Kotlin (Android)
- **State Management:** Redux / MobX / Provider
- **Navigation:** React Navigation / Flutter Navigation

### Backend Integration
- REST API or GraphQL integration
- Real-time features (WebSockets/Push notifications)
- Offline data synchronization
- Background processing

### Device Features
- Camera and photo library access
- GPS location services
- Push notifications
- Biometric authentication
- Device storage

### Performance Requirements
- App launch time < 3 seconds
- Screen transition animations < 300ms
- Memory usage optimization
- Battery usage optimization

## Platform-Specific Considerations
### iOS Requirements
- iOS 13.0+ minimum version
- App Store guidelines compliance
- iOS design guidelines (Human Interface Guidelines)
- TestFlight beta testing

### Android Requirements
- Android 8.0+ (API level 26) minimum
- Google Play Store guidelines
- Material Design guidelines
- Google Play Console testing

## User Interface Design
- Responsive design for different screen sizes
- Dark mode support
- Accessibility compliance (WCAG 2.1)
- Consistent design system

## Security & Privacy
- Secure data storage (Keychain/Keystore)
- API communication encryption
- Privacy policy compliance (GDPR/CCPA)
- App security best practices

## Testing Strategy
- Unit testing (80%+ coverage)
- UI/E2E testing (Detox/Appium)
- Device testing on multiple screen sizes
- Performance testing
- Security testing

## App Store Deployment
- App store optimization (ASO)
- App icons and screenshots
- Store listing content
- Release management strategy

## Analytics & Monitoring
- User analytics (Firebase/Analytics)
- Crash reporting (Crashlytics/Sentry)
- Performance monitoring
- User feedback collection

## Success Metrics
- App store ratings > 4.0
- User retention rates
- Daily/Monthly active users
- App performance metrics
- Conversion rates`
            },
            {
                id: 'data-analysis',
                name: 'Data Analysis Project',
                description: 'Template for data analysis and visualization projects',
                category: 'data',
                content: `# Product Requirements Document - Data Analysis Project

## Overview
**Project Name:** [Your Analysis Project]
**Analysis Type:** [Descriptive/Predictive/Prescriptive]
**Date:** ${new Date().toISOString().split('T')[0]}
**Author:** [Your Name]

## Executive Summary
Description of the business problem, data sources, and expected insights.

## Project Goals
- Goal 1: [Specific business question to answer]
- Goal 2: [Specific prediction to make]
- Goal 3: [Specific recommendation to provide]

## Business Requirements
### Key Questions
1. What patterns exist in the current data?
2. What factors influence [target variable]?
3. What predictions can be made for [future outcome]?
4. What recommendations can improve [business metric]?

### Success Criteria
- Actionable insights for stakeholders
- Statistical significance in findings
- Reproducible analysis pipeline
- Clear visualization and reporting

## Data Requirements
### Data Sources
1. **Primary Data**
   - Source: [Database/API/Files]
   - Format: [CSV/JSON/SQL]
   - Size: [Volume estimate]
   - Update frequency: [Real-time/Daily/Monthly]

2. **External Data**
   - Third-party APIs
   - Public datasets
   - Market research data

### Data Quality Requirements
- Data completeness (< 5% missing values)
- Data accuracy validation
- Data consistency checks
- Historical data availability

## Technical Requirements
### Data Pipeline
- Data extraction and ingestion
- Data cleaning and preprocessing
- Data transformation and feature engineering
- Data validation and quality checks

### Analysis Tools
- **Programming:** Python/R/SQL
- **Libraries:** pandas, numpy, scikit-learn, matplotlib
- **Visualization:** Tableau, PowerBI, or custom dashboards
- **Version Control:** Git for code and DVC for data

### Computing Resources
- Local development environment
- Cloud computing (AWS/GCP/Azure) if needed
- Database access and permissions
- Storage requirements

## Analysis Methodology
### Data Exploration
1. Descriptive statistics and data profiling
2. Data visualization and pattern identification
3. Correlation analysis
4. Outlier detection and handling

### Statistical Analysis
1. Hypothesis formulation
2. Statistical testing
3. Confidence intervals
4. Effect size calculations

### Machine Learning (if applicable)
1. Feature selection and engineering
2. Model selection and training
3. Cross-validation and evaluation
4. Model interpretation and explainability

## Deliverables
### Reports
- Executive summary for stakeholders
- Technical analysis report
- Data quality report
- Methodology documentation

### Visualizations
- Interactive dashboards
- Static charts and graphs
- Data story presentations
- Key findings infographics

### Code & Documentation
- Reproducible analysis scripts
- Data pipeline code
- Documentation and comments
- Testing and validation code

## Timeline
- Phase 1: Data collection and exploration (2 weeks)
- Phase 2: Analysis and modeling (3 weeks)
- Phase 3: Reporting and visualization (1 week)
- Phase 4: Stakeholder presentation (1 week)

## Risks & Assumptions
- Data availability and quality risks
- Technical complexity assumptions
- Resource and timeline constraints
- Stakeholder engagement assumptions

## Success Metrics
- Stakeholder satisfaction with insights
- Accuracy of predictions (if applicable)
- Business impact of recommendations
- Reproducibility of results`
            }
        ];

        res.json({
            templates,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('PRD templates error:', error);
        res.status(500).json({
            error: 'Failed to get PRD templates',
            message: error.message
        });
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
            return res.status(400).json({
                error: 'Missing required parameter',
                message: 'templateId is required'
            });
        }

        // 获取项目路径
        let projectPath;
        try {
            projectPath = await extractProjectDirectory(projectName);
        } catch (error) {
            return res.status(404).json({
                error: 'Project not found',
                message: `Project "${projectName}" does not exist`
            });
        }

        // 获取模板内容（通常会从模板列表中获取）
        const templates = await getAvailableTemplates();
        const template = templates.find(t => t.id === templateId);

        if (!template) {
            return res.status(404).json({
                error: 'Template not found',
                message: `Template "${templateId}" does not exist`
            });
        }

        // 将自定义项应用到模板内容
        let content = template.content;

        // 用自定义项替换占位符
        for (const [key, value] of Object.entries(customizations)) {
            const placeholder = `[${key}]`;
            content = content.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), value);
        }

        // 确保 .taskmaster/docs 目录存在
        const docsDir = path.join(projectPath, '.taskmaster', 'docs');
        try {
            await fsPromises.mkdir(docsDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create docs directory:', error);
        }

        const filePath = path.join(docsDir, fileName);

        // 将模板内容写入文件
        try {
            await fsPromises.writeFile(filePath, content, 'utf8');

            res.json({
                projectName,
                projectPath,
                templateId,
                templateName: template.name,
                fileName,
                filePath: filePath,
                message: 'PRD template applied successfully',
                timestamp: new Date().toISOString()
            });

        } catch (writeError) {
            console.error('Failed to write PRD template:', writeError);
            return res.status(500).json({
                error: 'Failed to write PRD template',
                message: writeError.message
            });
        }

    } catch (error) {
        console.error('Apply template error:', error);
        res.status(500).json({
            error: 'Failed to apply PRD template',
            message: error.message
        });
    }
});

// 获取可用模板的辅助函数
async function getAvailableTemplates() {
    // 这可以扩展为从文件或数据库读取
    return [
        {
            id: 'web-app',
            name: 'Web Application',
            description: 'Template for web application projects',
            category: 'web',
            content: `# Product Requirements Document - Web Application

## Overview
**Product Name:** [Your App Name]
**Version:** 1.0
**Date:** ${new Date().toISOString().split('T')[0]}
**Author:** [Your Name]

## Executive Summary
Brief description of what this web application will do and why it's needed.

## User Stories
1. As a user, I want [feature] so I can [benefit]
2. As a user, I want [feature] so I can [benefit]
3. As a user, I want [feature] so I can [benefit]

## Technical Requirements
- Frontend framework
- Backend services
- Database requirements
- Security considerations

## Success Metrics
- User engagement metrics
- Performance benchmarks
- Business objectives`
        },
        // 如果需要，在此添加其他模板
    ];
}

export default router;
