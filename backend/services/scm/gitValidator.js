/**
 * Git 仓库验证模块
 *
 * 提供仓库路径解析和验证功能。
 * 使用 spawn + 参数数组执行 git 命令，防止命令注入。
 *
 * @module services/scm/gitValidator
 */

import path from 'path';
import { promises as fs } from 'fs';
import { extractProjectDirectory } from '../projects/index.js';
import { createLogger } from '../../utils/logger.js';
import { gitSpawn } from './gitSpawn.js';

const logger = createLogger('services/scm/gitValidator');

// 在 Git 操作前调用，将编码后的项目名称解码为实际文件系统路径
// gitValidator.js 功能函数
/**
 * 从编码的项目名称中获取实际项目路径
 * @param {string} projectName - 编码的项目名称
 * @returns {Promise<string>} 实际项目路径
 */
export async function resolveProjectPath(projectName) {
    try {
        return await extractProjectDirectory(projectName);
    } catch (error) {
        logger.error(`Error extracting project directory for ${projectName}:`, error);
        return projectName.replace(/-/g, '/');
    }
}

// 在执行 Git 操作前调用，验证路径是否存在且为 Git 仓库根目录
// gitValidator.js 功能函数
/**
 * 验证指定路径是否为有效的 git 仓库
 * @param {string} projectPath - 项目路径
 * @returns {Promise<void>} 验证通过，否则抛出错误
 * @throws {Error} 路径不存在或不是 git 仓库
 */
export async function validateRepository(projectPath) {
    try {
        await fs.access(projectPath);
    } catch {
        throw new Error(`Project path not found: ${projectPath}`);
    }

    try {
        const { stdout: gitRoot } = await gitSpawn(['rev-parse', '--show-toplevel'], projectPath);
        const normalizedGitRoot = path.resolve(gitRoot.trim());
        const normalizedProjectPath = path.resolve(projectPath);

        if (normalizedGitRoot !== normalizedProjectPath) {
            throw new Error(`Project directory is not a git repository. This directory is inside a git repository at ${normalizedGitRoot}, but git operations should be run from the repository root.`);
        }
    } catch (error) {
        if (error.message.includes('Project directory is not a git repository')) throw error;
        throw new Error('Not a git repository. This directory does not contain a .git folder. Initialize a git repository with "git init" to use source control features.');
    }
}
