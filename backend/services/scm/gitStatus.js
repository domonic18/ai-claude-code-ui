/**
 * Git 状态与 Diff 查询模块
 *
 * 提供仓库状态查询、文件 diff、提交历史、远程状态等功能。
 *
 * @module services/scm/gitStatus
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { validateRepository } from './gitValidator.js';

const execAsync = promisify(exec);

/**
 * 获取仓库状态（分支、文件变更列表）
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{branch: string, hasCommits: boolean, modified: string[], added: string[], deleted: string[], untracked: string[]}>}
 */
export async function getStatus(projectPath) {
    await validateRepository(projectPath);

    // 获取当前分支
    let branch = 'main';
    let hasCommits = true;
    try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
        branch = stdout.trim();
    } catch (error) {
        if (error.message.includes('unknown revision') || error.message.includes('ambiguous argument')) {
            hasCommits = false;
        } else {
            throw error;
        }
    }

    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectPath });

    const modified = [];
    const added = [];
    const deleted = [];
    const untracked = [];

    statusOutput.split('\n').forEach(line => {
        if (!line.trim()) return;
        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status === 'M ' || status === ' M' || status === 'MM') modified.push(file);
        else if (status === 'A ' || status === 'AM') added.push(file);
        else if (status === 'D ' || status === ' D') deleted.push(file);
        else if (status === '??') untracked.push(file);
    });

    return { branch, hasCommits, modified, added, deleted, untracked };
}

/**
 * 获取特定文件的 diff
 * @param {string} projectPath - 项目路径
 * @param {string} file - 文件路径
 * @returns {Promise<string>} diff 内容
 */
export async function getFileDiff(projectPath, file) {
    await validateRepository(projectPath);

    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
    const isUntracked = statusOutput.startsWith('??');
    const isDeleted = statusOutput.trim().startsWith('D ') || statusOutput.trim().startsWith(' D');

    if (isUntracked) {
        const filePath = path.join(projectPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) return `Directory: ${file}\n(Cannot show diff for directories)`;
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        return `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` + lines.map(l => `+${l}`).join('\n');
    }

    if (isDeleted) {
        const { stdout: fileContent } = await execAsync(`git show HEAD:"${file}"`, { cwd: projectPath });
        const lines = fileContent.split('\n');
        return `--- a/${file}\n+++ /dev/null\n@@ -1,${lines.length} +0,0 @@\n` + lines.map(l => `-${l}`).join('\n');
    }

    const { stdout: unstagedDiff } = await execAsync(`git diff -- "${file}"`, { cwd: projectPath });
    if (unstagedDiff) return stripDiffHeaders(unstagedDiff);

    const { stdout: stagedDiff } = await execAsync(`git diff --cached -- "${file}"`, { cwd: projectPath });
    return stripDiffHeaders(stagedDiff) || '';
}

/**
 * 获取文件内容和 diff 信息（用于 CodeEditor）
 * @param {string} projectPath - 项目路径
 * @param {string} file - 文件路径
 * @returns {Promise<{currentContent: string, oldContent: string, isDeleted: boolean, isUntracked: boolean}>}
 */
export async function getFileWithDiff(projectPath, file) {
    await validateRepository(projectPath);

    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
    const isUntracked = statusOutput.startsWith('??');
    const isDeleted = statusOutput.trim().startsWith('D ') || statusOutput.trim().startsWith(' D');

    let currentContent = '';
    let oldContent = '';

    if (isDeleted) {
        const { stdout } = await execAsync(`git show HEAD:"${file}"`, { cwd: projectPath });
        oldContent = stdout;
        currentContent = stdout;
    } else {
        const filePath = path.join(projectPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) throw new Error('Cannot show diff for directories');

        currentContent = await fs.readFile(filePath, 'utf-8');
        if (!isUntracked) {
            try {
                const { stdout } = await execAsync(`git show HEAD:"${file}"`, { cwd: projectPath });
                oldContent = stdout;
            } catch {
                oldContent = '';
            }
        }
    }

    return { currentContent, oldContent, isDeleted, isUntracked };
}

/**
 * 获取提交历史
 * @param {string} projectPath - 项目路径
 * @param {number} [limit=10] - 返回条数
 * @returns {Promise<Array<{hash: string, author: string, email: string, date: string, message: string, stats: string}>>}
 */
export async function getCommits(projectPath, limit = 10) {
    await validateRepository(projectPath);

    const { stdout } = await execAsync(
        `git log --pretty=format:'%H|%an|%ae|%ad|%s' --date=relative -n ${limit}`,
        { cwd: projectPath }
    );

    const commits = stdout.split('\n').filter(l => l.trim()).map(line => {
        const [hash, author, email, date, ...messageParts] = line.split('|');
        return { hash, author, email, date, message: messageParts.join('|'), stats: '' };
    });

    for (const commit of commits) {
        try {
            const { stdout: stats } = await execAsync(`git show --stat --format='' ${commit.hash}`, { cwd: projectPath });
            commit.stats = stats.trim().split('\n').pop();
        } catch { /* ignore */ }
    }

    return commits;
}

/**
 * 获取特定提交的完整 diff
 * @param {string} projectPath - 项目路径
 * @param {string} commit - 提交哈希
 * @returns {Promise<string>} diff 内容
 */
export async function getCommitDiff(projectPath, commit) {
    const { stdout } = await execAsync(`git show ${commit}`, { cwd: projectPath });
    return stdout;
}

/**
 * 获取远程状态（ahead/behind 信息）
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object>} 远程状态信息
 */
export async function getRemoteStatus(projectPath) {
    await validateRepository(projectPath);

    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const branch = currentBranch.trim();

    let trackingBranch;
    let remoteName;
    try {
        const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
        trackingBranch = stdout.trim();
        remoteName = trackingBranch.split('/')[0];
    } catch {
        // 没有上游分支
        let hasRemote = false;
        let detectedRemote = null;
        try {
            const { stdout } = await execAsync('git remote', { cwd: projectPath });
            const remotes = stdout.trim().split('\n').filter(r => r.trim());
            if (remotes.length > 0) {
                hasRemote = true;
                detectedRemote = remotes.includes('origin') ? 'origin' : remotes[0];
            }
        } catch { /* no remote */ }

        return { hasRemote, hasUpstream: false, branch, remoteName: detectedRemote, message: 'No remote tracking branch configured' };
    }

    const { stdout: countOutput } = await execAsync(`git rev-list --count --left-right ${trackingBranch}...HEAD`, { cwd: projectPath });
    const [behind, ahead] = countOutput.trim().split('\t').map(Number);

    return {
        hasRemote: true,
        hasUpstream: true,
        branch,
        remoteBranch: trackingBranch,
        remoteName,
        ahead: ahead || 0,
        behind: behind || 0,
        isUpToDate: ahead === 0 && behind === 0
    };
}

/**
 * 获取分支列表
 * @param {string} projectPath - 项目路径
 * @returns {Promise<string[]>} 分支名称列表
 */
export async function getBranches(projectPath) {
    await validateRepository(projectPath);

    const { stdout } = await execAsync('git branch -a', { cwd: projectPath });
    return stdout
        .split('\n')
        .map(b => b.trim())
        .filter(b => b && !b.includes('->'))
        .map(b => {
            if (b.startsWith('* ')) return b.substring(2);
            if (b.startsWith('remotes/origin/')) return b.substring(15);
            return b;
        })
        .filter((b, i, self) => self.indexOf(b) === i);
}

/**
 * 去除 git diff 头部信息
 * @param {string} diff - 原始 diff 输出
 * @returns {string} 清理后的 diff
 */
export function stripDiffHeaders(diff) {
    if (!diff) return '';

    const lines = diff.split('\n');
    const filtered = [];
    let startIncluding = false;

    for (const line of lines) {
        if (line.startsWith('diff --git') || line.startsWith('index ') ||
            line.startsWith('new file mode') || line.startsWith('deleted file mode') ||
            line.startsWith('---') || line.startsWith('+++')) {
            continue;
        }
        if (line.startsWith('@@') || startIncluding) {
            startIncluding = true;
            filtered.push(line);
        }
    }

    return filtered.join('\n');
}
