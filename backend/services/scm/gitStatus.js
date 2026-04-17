/**
 * Git 状态与 Diff 查询模块
 *
 * 提供仓库状态查询、文件 diff、提交历史、远程状态等功能。
 * 使用 spawn + 参数数组执行 git 命令，防止命令注入。
 *
 * @module services/scm/gitStatus
 */

import path from 'path';
import { promises as fs } from 'fs';
import { validateRepository } from './gitValidator.js';
import { gitSpawn } from './gitSpawn.js';
import { parseStatusOutput, stripDiffHeaders } from './gitStatusParser.js';

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
        const { stdout } = await gitSpawn(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath);
        branch = stdout.trim();
    } catch (error) {
        if (error.message.includes('unknown revision') || error.message.includes('ambiguous argument')) {
            hasCommits = false;
        } else {
            throw error;
        }
    }

    const { stdout: statusOutput } = await gitSpawn(['status', '--porcelain'], projectPath);
    return { branch, hasCommits, ...parseStatusOutput(statusOutput) };
}

/**
 * 获取特定文件的 diff
 * @param {string} projectPath - 项目路径
 * @param {string} file - 文件路径
 * @returns {Promise<string>} diff 内容
 */
export async function getFileDiff(projectPath, file) {
    await validateRepository(projectPath);

    const { stdout: statusOutput } = await gitSpawn(['status', '--porcelain', '--', file], projectPath);
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
        const { stdout: fileContent } = await gitSpawn(['show', `HEAD:${file}`], projectPath);
        const lines = fileContent.split('\n');
        return `--- a/${file}\n+++ /dev/null\n@@ -1,${lines.length} +0,0 @@\n` + lines.map(l => `-${l}`).join('\n');
    }

    const { stdout: unstagedDiff } = await gitSpawn(['diff', '--', file], projectPath);
    if (unstagedDiff) return stripDiffHeaders(unstagedDiff);

    const { stdout: stagedDiff } = await gitSpawn(['diff', '--cached', '--', file], projectPath);
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

    const { stdout: statusOutput } = await gitSpawn(['status', '--porcelain', '--', file], projectPath);
    const isUntracked = statusOutput.startsWith('??');
    const isDeleted = statusOutput.trim().startsWith('D ') || statusOutput.trim().startsWith(' D');

    let currentContent = '';
    let oldContent = '';

    if (isDeleted) {
        const { stdout } = await gitSpawn(['show', `HEAD:${file}`], projectPath);
        oldContent = stdout;
        currentContent = stdout;
    } else {
        const filePath = path.join(projectPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) throw new Error('Cannot show diff for directories');

        currentContent = await fs.readFile(filePath, 'utf-8');
        if (!isUntracked) {
            try {
                const { stdout } = await gitSpawn(['show', `HEAD:${file}`], projectPath);
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

    // 安全转换 limit 为整数
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 10)));

    // 一次性获取 commits + stats，避免 N+1
    const { stdout } = await gitSpawn([
        'log', `--pretty=format:%H|%an|%ae|%ad|%s`, '--stat', '--date=relative', `-n`, String(safeLimit)
    ], projectPath);

    // 按 commit 边界分割（每个 commit 以空行后的 hash 开头）
    const commitBlocks = stdout.split(/(?=^[a-f0-9]{40}\|)/m).filter(b => b.trim());

    return commitBlocks.map(block => {
        const lines = block.split('\n');
        const firstLine = lines[0];
        const [hash, author, email, date, ...messageParts] = firstLine.split('|');
        const message = messageParts.join('|');

        // stats 在最后的 summary 行
        const statsLines = lines.slice(1).join('\n').trim();
        const lastLine = statsLines.split('\n').pop() || '';

        return { hash, author, email, date, message, stats: lastLine };
    });
}

/**
 * 获取特定提交的完整 diff
 * @param {string} projectPath - 项目路径
 * @param {string} commit - 提交哈希（仅允许 hex 字符）
 * @returns {Promise<string>} diff 内容
 */
export async function getCommitDiff(projectPath, commit) {
    // 校验 commit hash 格式，防止注入
    if (!/^[a-f0-9]+$/i.test(commit)) {
        throw new Error('Invalid commit hash format');
    }
    const { stdout } = await gitSpawn(['show', commit], projectPath);
    return stdout;
}

/**
 * 获取远程状态（ahead/behind 信息）
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Object>} 远程状态信息
 */
export async function getRemoteStatus(projectPath) {
    await validateRepository(projectPath);

    const { stdout: currentBranch } = await gitSpawn(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath);
    const branch = currentBranch.trim();

    let trackingBranch;
    let remoteName;
    try {
        const { stdout } = await gitSpawn(['rev-parse', '--abbrev-ref', `${branch}@{upstream}`], projectPath);
        trackingBranch = stdout.trim();
        remoteName = trackingBranch.split('/')[0];
    } catch {
        // 没有上游分支
        let hasRemote = false;
        let detectedRemote = null;
        try {
            const { stdout } = await gitSpawn(['remote'], projectPath);
            const remotes = stdout.trim().split('\n').filter(r => r.trim());
            if (remotes.length > 0) {
                hasRemote = true;
                detectedRemote = remotes.includes('origin') ? 'origin' : remotes[0];
            }
        } catch { /* no remote */ }

        return { hasRemote, hasUpstream: false, branch, remoteName: detectedRemote, message: 'No remote tracking branch configured' };
    }

    const { stdout: countOutput } = await gitSpawn(['rev-list', '--count', '--left-right', `${trackingBranch}...HEAD`], projectPath);
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

    const { stdout } = await gitSpawn(['branch', '-a'], projectPath);
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

export { stripDiffHeaders } from './gitStatusParser.js';
