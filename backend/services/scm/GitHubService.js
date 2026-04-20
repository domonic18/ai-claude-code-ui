/**
 * GitHub 集成服务
 *
 * 封装与 GitHub 交互的所有操作：
 * - 仓库克隆和远程 URL 检测
 * - 分支创建（本地 + 远程推送）
 * - Pull Request 创建
 * - 分支名生成和校验
 * - 提交消息获取
 * - 临时项目清理
 *
 * @module services/scm/GitHubService
 */

import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createLogger } from '../../utils/logger.js';
import { Octokit } from '@octokit/rest';

const logger = createLogger('services/scm/GitHubService');

// ─── URL 解析工具 ──────────────────────────────────────

/**
 * 规范化 GitHub URL 以进行比较
 * @param {string} url - GitHub URL
 * @returns {string} 规范化后的 URL（小写）
 */
export function normalizeGitHubUrl(url) {
    let normalized = url.replace(/\.git$/, '');
    normalized = normalized.replace(/^git@github\.com:/, 'https://github.com/');
    normalized = normalized.replace(/\/$/, '');
    return normalized.toLowerCase();
}

/**
 * 解析 GitHub URL 以提取 owner 和 repo
 * @param {string} url - GitHub URL（HTTPS 或 SSH）
 * @returns {{owner: string, repo: string}}
 * @throws {Error} URL 格式无效时抛出错误
 */
export function parseGitHubUrl(url) {
    const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (!match) {
        throw new Error('Invalid GitHub URL format');
    }
    return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '')
    };
}

// ─── 分支名工具 ────────────────────────────────────────

/**
 * 从消息自动生成分支名称
 * @param {string} message - 代理消息
 * @returns {string} 合法的分支名称
 */
export function autogenerateBranchName(message) {
    let branchName = message
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    if (!branchName) {
        branchName = 'task';
    }

    const timestamp = Date.now().toString(36).slice(-6);
    const suffix = `-${timestamp}`;
    const maxBaseLength = 50 - suffix.length;
    if (branchName.length > maxBaseLength) {
        branchName = branchName.substring(0, maxBaseLength);
    }

    branchName = branchName.replace(/-$/, '').replace(/^-+/, '');

    if (!branchName || branchName.startsWith('-')) {
        branchName = 'task';
    }

    branchName = `${branchName}${suffix}`;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branchName)) {
        return `branch-${timestamp}`;
    }

    return branchName;
}

/**
 * 验证 Git 分支名称是否合法
 * @param {string} branchName - 要验证的分支名称
 * @returns {{valid: boolean, error?: string}}
 */
export function validateBranchName(branchName) {
    if (!branchName || branchName.trim() === '') {
        return { valid: false, error: 'Branch name cannot be empty' };
    }

    const invalidPatterns = [
        { pattern: /^\./, message: 'Branch name cannot start with a dot' },
        { pattern: /\.$/, message: 'Branch name cannot end with a dot' },
        { pattern: /\.\./, message: 'Branch name cannot contain consecutive dots (..)' },
        { pattern: /\s/, message: 'Branch name cannot contain spaces' },
        { pattern: /[~^:?*\[\\]/, message: 'Branch name cannot contain special characters: ~ ^ : ? * [ \\' },
        { pattern: /@{/, message: 'Branch name cannot contain @{' },
        { pattern: /\/$/, message: 'Branch name cannot end with a slash' },
        { pattern: /^\//, message: 'Branch name cannot start with a slash' },
        { pattern: /\/\//, message: 'Branch name cannot contain consecutive slashes' },
        { pattern: /\.lock$/, message: 'Branch name cannot end with .lock' }
    ];

    for (const { pattern, message } of invalidPatterns) {
        if (pattern.test(branchName)) {
            return { valid: false, error: message };
        }
    }

    if (/[\x00-\x1F\x7F]/.test(branchName)) {
        return { valid: false, error: 'Branch name cannot contain control characters' };
    }

    return { valid: true };
}

// ─── 清理 ──────────────────────────────────────────────

/**
 * 清理关联的 Claude 会话目录
 * @param {string|null} sessionId - 会话 ID
 */
async function cleanupSessionDir(sessionId) {
    if (!sessionId) return;
    try {
        const sessionPath = path.join(os.homedir(), '.claude', 'sessions', sessionId);
        await fs.rm(sessionPath, { recursive: true, force: true });
    } catch (error) {
        logger.warn({ sessionId, error: error.message }, 'Failed to clean up session directory');
    }
}

/**
 * 清理临时项目目录及其 Claude 会话
 * @param {string} projectPath - 项目目录路径
 * @param {string|null} sessionId - 关联的会话 ID
 */
export async function cleanupProject(projectPath, sessionId = null) {
    const startTime = Date.now();
    logger.info({ projectPath, sessionId }, 'cleanupProject START');

    if (!projectPath.includes('.claude/external-projects')) {
        logger.info({ projectPath }, 'cleanupProject SKIP - not in external-projects');
        return;
    }

    try {
        await fs.rm(projectPath, { recursive: true, force: true });
        logger.info({ projectPath, duration: Date.now() - startTime }, 'cleanupProject cleaned');
        await cleanupSessionDir(sessionId);
    } catch (error) {
        logger.error({ error: error.message, projectPath }, 'cleanupProject FAILED');
    }
}

// ─── Re-exports ─────────────────────────────────────────

// Re-export from gitBranchOperations
export { checkoutBranch, pushBranchToRemote, createAndPushBranch, createGitHubBranch } from './gitBranchOperations.js';

// Re-export from gitWorkflowExecutor
export {
    cloneGitHubRepo,
    getGitRemoteUrl,
    getCommitMessages,
    createGitHubPR,
    executeGitHubWorkflow
} from './gitWorkflowExecutor.js';

// Re-export Octokit for convenience
export { Octokit };

