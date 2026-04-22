/**
 * Git 远程操作模块
 *
 * 提供 fetch、pull、push、发布分支等远程仓库操作。
 * 使用 spawn + 参数数组执行 git 命令，防止命令注入。
 *
 * @module services/scm/gitRemote
 */

import { validateRepository } from './gitValidator.js';
import { gitSpawn } from './gitSpawn.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/scm/gitRemote');

// gitRemote.js 功能函数
/**
 * 获取远程仓库的跟踪分支和远程名称
 * @private
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{remoteName: string, remoteBranch: string}>}
 */
async function resolveRemoteInfo(projectPath) {
    const { stdout: currentBranch } = await gitSpawn(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath);
    const branch = currentBranch.trim();

    let remoteName = 'origin';
    let remoteBranch = branch;
    try {
        const { stdout } = await gitSpawn(['rev-parse', '--abbrev-ref', `${branch}@{upstream}`], projectPath);
        const tracking = stdout.trim();
        remoteName = tracking.split('/')[0];
        remoteBranch = tracking.split('/').slice(1).join('/');
    } catch {
        logger.info('No upstream configured, using origin/branch as fallback');
    }

    return { remoteName, remoteBranch };
}

// gitRemote.js 功能函数
/**
 * 从远程获取
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string, remoteName: string}>}
 */
export async function fetchFromRemote(projectPath) {
    await validateRepository(projectPath);
    const { remoteName } = await resolveRemoteInfo(projectPath);
    const { stdout } = await gitSpawn(['fetch', remoteName], projectPath);
    return { output: stdout || 'Fetch completed successfully', remoteName };
}

// gitRemote.js 功能函数
/**
 * 从远程拉取
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string, remoteName: string, remoteBranch: string}>}
 */
export async function pullFromRemote(projectPath) {
    await validateRepository(projectPath);
    const { remoteName, remoteBranch } = await resolveRemoteInfo(projectPath);
    const { stdout } = await gitSpawn(['pull', remoteName, remoteBranch], projectPath);
    return { output: stdout || 'Pull completed successfully', remoteName, remoteBranch };
}

// gitRemote.js 功能函数
/**
 * 推送到远程
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string, remoteName: string, remoteBranch: string}>}
 */
export async function pushToRemote(projectPath) {
    await validateRepository(projectPath);
    const { remoteName, remoteBranch } = await resolveRemoteInfo(projectPath);
    const { stdout } = await gitSpawn(['push', remoteName, remoteBranch], projectPath);
    return { output: stdout || 'Push completed successfully', remoteName, remoteBranch };
}

// gitRemote.js 功能函数
/**
 * 发布分支（设置上游并推送）
 * @param {string} projectPath - 项目路径
 * @param {string} branch - 分支名称
 * @returns {Promise<{output: string, remoteName: string}>}
 */
export async function publishBranch(projectPath, branch) {
    await validateRepository(projectPath);

    const { stdout: currentBranch } = await gitSpawn(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath);
    if (currentBranch.trim() !== branch) {
        throw new Error(`Branch mismatch. Current branch is ${currentBranch.trim()}, but trying to publish ${branch}`);
    }

    let remoteName = 'origin';
    try {
        const { stdout } = await gitSpawn(['remote'], projectPath);
        const remotes = stdout.trim().split('\n').filter(r => r.trim());
        if (remotes.length === 0) {
            throw new Error('No remote repository configured. Add a remote with: git remote add origin <url>');
        }
        remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
    } catch (error) {
        if (error.message.includes('No remote')) throw error;
        throw new Error('No remote repository configured. Add a remote with: git remote add origin <url>');
    }

    const { stdout } = await gitSpawn(['push', '--set-upstream', remoteName, branch], projectPath);
    return { output: stdout || 'Branch published successfully', remoteName };
}
