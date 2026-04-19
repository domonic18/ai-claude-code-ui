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
import { Octokit } from '@octokit/rest';
import { createLogger } from '../../utils/logger.js';
import { gitSpawn } from './gitSpawn.js';
import { buildCloneAuth } from './GitAuthHelper.js';

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

// ─── Git 操作 ──────────────────────────────────────────

/**
 * 获取 git 仓库的远程 URL
 * @param {string} repoPath - git 仓库的路径
 * @returns {Promise<string>} 远程 URL
 */
export async function getGitRemoteUrl(repoPath) {
    const { stdout } = await gitSpawn(['config', '--get', 'remote.origin.url'], repoPath);
    return stdout.trim();
}

/**
 * 从仓库获取最近的提交消息
 * @param {string} projectPath - git 仓库的路径
 * @param {number} [limit=5] - 提交数量
 * @returns {Promise<string[]>} 提交消息数组
 */
export async function getCommitMessages(projectPath, limit = 5) {
    const { stdout } = await gitSpawn(['log', `-${limit}`, '--pretty=format:%s'], projectPath);
    return stdout.trim().split('\n').filter(msg => msg.length > 0);
}

/**
 * 检查目标目录是否已包含正确的仓库
 * @param {string} cloneDir - 目标目录
 * @param {string} githubUrl - 期望的 GitHub URL
 * @returns {Promise<string|null>} 如果目录已存在且匹配则返回路径，否则返回 null
 * @throws {Error} 如果目录已存在但仓库不匹配
 */
async function checkExistingRepo(cloneDir, githubUrl) {
    try {
        await fs.access(cloneDir);
    } catch {
        return null; // 目录不存在
    }

    // 目录已存在，检查仓库 URL
    try {
        const existingUrl = await getGitRemoteUrl(cloneDir);
        if (normalizeGitHubUrl(existingUrl) === normalizeGitHubUrl(githubUrl)) {
            logger.info({ cloneDir, githubUrl }, 'Repository already exists at path with correct URL');
            return cloneDir;
        }
        throw new Error(`Directory ${cloneDir} already exists with a different repository (${existingUrl}). Expected: ${githubUrl}`);
    } catch (gitError) {
        if (gitError.message.includes('already exists with a different repository')) {
            throw gitError;
        }
        throw new Error(`Directory ${cloneDir} already exists but is not a valid git repository`);
    }
}

/**
 * 执行 git clone 操作（统一有 token 和无 token 两条路径）
 * @param {string} githubUrl - GitHub 仓库 URL
 * @param {string} cloneDir - 目标目录
 * @param {string|null} githubToken - GitHub 令牌
 */
async function performClone(githubUrl, cloneDir, githubToken) {
    const { env, cleanup } = await buildCloneAuth(githubToken);

    try {
        await gitSpawn(['clone', '--depth', '1', githubUrl, cloneDir], process.cwd(), {
            env,
            timeout: 60000,
        });
        logger.info({ cloneDir, githubUrl }, 'Repository cloned successfully');
    } catch (error) {
        logger.error({ error: error.message, githubUrl, cloneDir }, 'Git clone failed');
        throw new Error(`Git clone failed: ${error.message}`);
    } finally {
        await cleanup();
    }
}

/**
 * 将 GitHub 仓库克隆到指定目录
 * @param {string} githubUrl - GitHub 仓库 URL
 * @param {string|null} githubToken - GitHub 令牌（可选，用于私有仓库）
 * @param {string} projectPath - 克隆目标路径
 * @returns {Promise<string>} 克隆后的路径
 */
export async function cloneGitHubRepo(githubUrl, githubToken = null, projectPath) {
    if (!githubUrl || !githubUrl.includes('github.com')) {
        throw new Error('Invalid GitHub URL');
    }

    const cloneDir = path.resolve(projectPath);

    // 检查目录是否已存在
    const existing = await checkExistingRepo(cloneDir, githubUrl);
    if (existing) return existing;

    await fs.mkdir(path.dirname(cloneDir), { recursive: true });
    logger.info({ githubUrl, cloneDir }, 'Cloning repository');

    await performClone(githubUrl, cloneDir, githubToken);
    return cloneDir;
}

/**
 * 创建并 checkout 本地分支
 * @param {string} projectPath - 项目路径
 * @param {string} branchName - 分支名称
 */
async function checkoutBranch(projectPath, branchName) {
    try {
        await gitSpawn(['checkout', '-b', branchName], projectPath);
        logger.info({ branchName }, 'Created and checked out local branch');
        return;
    } catch (error) {
        if (!error.stderr || !error.stderr.includes('already exists')) {
            throw new Error(`Failed to create branch: ${error.stderr || error.message}`);
        }
    }

    // 分支已存在，checkout 已有分支
    logger.info({ branchName }, 'Branch already exists locally, checking out');
    try {
        await gitSpawn(['checkout', branchName], projectPath);
        logger.info({ branchName }, 'Checked out existing branch');
    } catch (error) {
        throw new Error(`Failed to checkout existing branch: ${error.stderr || error.message}`);
    }
}

/**
 * 推送分支到远程（容忍已存在的情况）
 * @param {string} projectPath - 项目路径
 * @param {string} branchName - 分支名称
 */
async function pushBranchToRemote(projectPath, branchName) {
    try {
        await gitSpawn(['push', '-u', 'origin', branchName], projectPath);
        logger.info({ branchName }, 'Pushed branch to remote');
    } catch (error) {
        const tolerable = error.stderr && (
            error.stderr.includes('already exists') || error.stderr.includes('up-to-date')
        );
        if (tolerable) {
            logger.info({ branchName }, 'Branch already exists on remote, using existing branch');
        } else {
            throw new Error(`Failed to push branch: ${error.stderr || error.message}`);
        }
    }
}

/**
 * 在本地创建并推送新分支到远程
 * @param {string} projectPath - 项目路径
 * @param {string} branchName - 分支名称
 * @returns {Promise<void>}
 */
export async function createAndPushBranch(projectPath, branchName) {
    await checkoutBranch(projectPath, branchName);
    await pushBranchToRemote(projectPath, branchName);
}

// ─── GitHub API 操作 ───────────────────────────────────

/**
 * 使用 GitHub API 创建远程分支
 * @param {Object} octokit - Octokit 实例
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @param {string} branchName - 新分支名称
 * @param {string} [baseBranch='main'] - 基础分支
 * @returns {Promise<void>}
 */
export async function createGitHubBranch(octokit, owner, repo, branchName, baseBranch = 'main') {
    try {
        const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
        await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: ref.object.sha });
        logger.info({ branchName, owner, repo }, `Created branch '${branchName}' on GitHub`);
    } catch (error) {
        if (error.status === 422 && error.message.includes('Reference already exists')) {
            logger.info({ branchName, owner, repo }, `Branch '${branchName}' already exists on GitHub`);
        } else {
            throw error;
        }
    }
}

/**
 * 创建 GitHub Pull Request
 * @param {Object} octokit - Octokit 实例
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @param {string} branchName - 头部分支
 * @param {string} title - PR 标题
 * @param {string} body - PR 描述
 * @param {string} [baseBranch='main'] - 基础分支
 * @returns {Promise<{number: number, url: string}>}
 */
export async function createGitHubPR(octokit, owner, repo, branchName, title, body, baseBranch = 'main') {
    const { data: pr } = await octokit.pulls.create({
        owner, repo, title, head: branchName, base: baseBranch, body
    });

    logger.info({ prNumber: pr.number, url: pr.html_url, owner, repo, branchName, title },
        `Created pull request #${pr.number}: ${pr.html_url}`);

    return { number: pr.number, url: pr.html_url };
}

/**
 * 执行完整的 GitHub 分支 + PR 工作流
 * @param {Object} params
 * @param {string} params.githubUrl - GitHub 仓库 URL
 * @param {string} params.projectPath - 本地项目路径
 * @param {string} params.branchName - 分支名称
 * @param {boolean} params.createBranch - 是否创建分支
 * @param {boolean} params.createPR - 是否创建 PR
 * @param {string} params.githubToken - GitHub 令牌
 * @param {string} params.message - 代理消息（用于 PR 描述回退）
 * @returns {Promise<{branchInfo: Object|null, prInfo: Object|null}>}
 */
export async function executeGitHubWorkflow(params) {
    const { githubUrl, projectPath, branchName, createBranch, createPR, githubToken, message } = params;

    const octokit = new Octokit({ auth: githubToken });

    // 获取仓库 URL
    let repoUrl = githubUrl;
    if (!repoUrl) {
        repoUrl = await getGitRemoteUrl(projectPath);
        if (!repoUrl.includes('github.com')) {
            throw new Error('Project does not have a GitHub remote configured');
        }
    }

    const { owner, repo } = parseGitHubUrl(repoUrl);
    logger.info({ owner, repo }, 'Repository info');

    let branchInfo = null;
    let prInfo = null;

    if (createBranch) {
        // 本地创建并推送分支
        await createAndPushBranch(projectPath, branchName);

        branchInfo = {
            name: branchName,
            url: `https://github.com/${owner}/${repo}/tree/${branchName}`
        };
    }

    if (createPR) {
        const commitMessages = await getCommitMessages(projectPath, 5);
        const prTitle = commitMessages.length > 0 ? commitMessages[0] : message;

        let prBody = '## Changes\n\n';
        prBody += commitMessages.length > 0
            ? commitMessages.map(msg => `- ${msg}`).join('\n')
            : `Agent task: ${message}`;
        prBody += '\n\n---\n*This pull request was automatically created by Claude Code UI Agent.*';

        prInfo = await createGitHubPR(octokit, owner, repo, branchName, prTitle, prBody, 'main');
    }

    return { branchInfo, prInfo };
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
