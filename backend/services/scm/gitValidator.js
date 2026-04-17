/**
 * Git 仓库验证模块
 *
 * 提供仓库路径解析和验证功能。
 *
 * @module services/scm/gitValidator
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { extractProjectDirectory } from '../projects/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/scm/gitValidator');
const execAsync = promisify(exec);

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
        const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', { cwd: projectPath });
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
