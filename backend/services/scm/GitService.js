/**
 * Git 操作服务
 *
 * 封装所有 git 命令执行和输出解析：
 * - 仓库验证和状态查询
 * - Diff、文件内容获取
 * - 提交、分支、远程操作
 * - AI 提交消息生成
 *
 * 不依赖 Express，所有方法返回纯数据或抛出 Error。
 *
 * @module services/scm/GitService
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { extractProjectDirectory } from '../projects/index.js';
import { queryClaudeSDK } from '../execution/claude/index.js';
import { spawnCursor } from '../execution/cursor/index.js';
import { createLogger, sanitizePreview } from '../../utils/logger.js';

const logger = createLogger('services/scm/GitService');
const execAsync = promisify(exec);

// ─── 路径与验证 ────────────────────────────────────────

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

// ─── 状态查询 ──────────────────────────────────────────

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

// ─── 写操作 ────────────────────────────────────────────

/**
 * 创建初始提交
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string}>}
 */
export async function createInitialCommit(projectPath) {
    await validateRepository(projectPath);

    try {
        await execAsync('git rev-parse HEAD', { cwd: projectPath });
        throw new Error('Repository already has commits. Use regular commit instead.');
    } catch (error) {
        if (error.message.includes('already has commits')) throw error;
    }

    await execAsync('git add .', { cwd: projectPath });
    const { stdout } = await execAsync('git commit -m "Initial commit"', { cwd: projectPath });
    return { output: stdout };
}

/**
 * 提交指定文件
 * @param {string} projectPath - 项目路径
 * @param {string[]} files - 文件列表
 * @param {string} message - 提交消息
 * @returns {Promise<{output: string}>}
 */
export async function commitFiles(projectPath, files, message) {
    await validateRepository(projectPath);

    for (const file of files) {
        await execAsync(`git add "${file}"`, { cwd: projectPath });
    }

    const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    return { output: stdout };
}

/**
 * 切换分支
 * @param {string} projectPath - 项目路径
 * @param {string} branch - 目标分支
 * @returns {Promise<{output: string}>}
 */
export async function checkoutBranch(projectPath, branch) {
    const { stdout } = await execAsync(`git checkout "${branch}"`, { cwd: projectPath });
    return { output: stdout };
}

/**
 * 创建并切换到新分支
 * @param {string} projectPath - 项目路径
 * @param {string} branch - 新分支名称
 * @returns {Promise<{output: string}>}
 */
export async function createBranch(projectPath, branch) {
    const { stdout } = await execAsync(`git checkout -b "${branch}"`, { cwd: projectPath });
    return { output: stdout };
}

/**
 * 获取远程仓库的跟踪分支和远程名称
 * @private
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{remoteName: string, remoteBranch: string}>}
 */
async function resolveRemoteInfo(projectPath) {
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const branch = currentBranch.trim();

    let remoteName = 'origin';
    let remoteBranch = branch;
    try {
        const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
        const tracking = stdout.trim();
        remoteName = tracking.split('/')[0];
        remoteBranch = tracking.split('/').slice(1).join('/');
    } catch {
        logger.info('No upstream configured, using origin/branch as fallback');
    }

    return { remoteName, remoteBranch };
}

/**
 * 从远程获取
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string, remoteName: string}>}
 */
export async function fetchFromRemote(projectPath) {
    await validateRepository(projectPath);
    const { remoteName } = await resolveRemoteInfo(projectPath);
    const { stdout } = await execAsync(`git fetch ${remoteName}`, { cwd: projectPath });
    return { output: stdout || 'Fetch completed successfully', remoteName };
}

/**
 * 从远程拉取
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string, remoteName: string, remoteBranch: string}>}
 */
export async function pullFromRemote(projectPath) {
    await validateRepository(projectPath);
    const { remoteName, remoteBranch } = await resolveRemoteInfo(projectPath);
    const { stdout } = await execAsync(`git pull ${remoteName} ${remoteBranch}`, { cwd: projectPath });
    return { output: stdout || 'Pull completed successfully', remoteName, remoteBranch };
}

/**
 * 推送到远程
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string, remoteName: string, remoteBranch: string}>}
 */
export async function pushToRemote(projectPath) {
    await validateRepository(projectPath);
    const { remoteName, remoteBranch } = await resolveRemoteInfo(projectPath);
    const { stdout } = await execAsync(`git push ${remoteName} ${remoteBranch}`, { cwd: projectPath });
    return { output: stdout || 'Push completed successfully', remoteName, remoteBranch };
}

/**
 * 发布分支（设置上游并推送）
 * @param {string} projectPath - 项目路径
 * @param {string} branch - 分支名称
 * @returns {Promise<{output: string, remoteName: string}>}
 */
export async function publishBranch(projectPath, branch) {
    await validateRepository(projectPath);

    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    if (currentBranch.trim() !== branch) {
        throw new Error(`Branch mismatch. Current branch is ${currentBranch.trim()}, but trying to publish ${branch}`);
    }

    let remoteName = 'origin';
    try {
        const { stdout } = await execAsync('git remote', { cwd: projectPath });
        const remotes = stdout.trim().split('\n').filter(r => r.trim());
        if (remotes.length === 0) {
            throw new Error('No remote repository configured. Add a remote with: git remote add origin <url>');
        }
        remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
    } catch (error) {
        if (error.message.includes('No remote')) throw error;
        throw new Error('No remote repository configured. Add a remote with: git remote add origin <url>');
    }

    const { stdout } = await execAsync(`git push --set-upstream ${remoteName} ${branch}`, { cwd: projectPath });
    return { output: stdout || 'Branch published successfully', remoteName };
}

/**
 * 丢弃指定文件的更改
 * @param {string} projectPath - 项目路径
 * @param {string} file - 文件路径
 * @returns {Promise<void>}
 */
export async function discardChanges(projectPath, file) {
    await validateRepository(projectPath);

    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
    if (!statusOutput.trim()) throw new Error('No changes to discard for this file');

    const status = statusOutput.substring(0, 2);
    if (status === '??') {
        const filePath = path.join(projectPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) await fs.rm(filePath, { recursive: true, force: true });
        else await fs.unlink(filePath);
    } else if (status.includes('M') || status.includes('D')) {
        await execAsync(`git restore "${file}"`, { cwd: projectPath });
    } else if (status.includes('A')) {
        await execAsync(`git reset HEAD "${file}"`, { cwd: projectPath });
    }
}

/**
 * 删除未跟踪的文件
 * @param {string} projectPath - 项目路径
 * @param {string} file - 文件路径
 * @returns {Promise<boolean>} 是否为目录
 */
export async function deleteUntracked(projectPath, file) {
    await validateRepository(projectPath);

    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
    if (!statusOutput.trim()) throw new Error('File is not untracked or does not exist');
    if (statusOutput.substring(0, 2) !== '??') throw new Error('File is not untracked. Use discard for tracked files.');

    const filePath = path.join(projectPath, file);
    const stats = await fs.stat(filePath);
    const isDir = stats.isDirectory();

    if (isDir) await fs.rm(filePath, { recursive: true, force: true });
    else await fs.unlink(filePath);

    return isDir;
}

// ─── AI 提交消息生成 ──────────────────────────────────

/**
 * 使用 AI 生成提交消息
 * @param {string} projectPath - 项目路径
 * @param {string[]} files - 文件列表
 * @param {string} provider - AI 提供者：'claude' 或 'cursor'
 * @returns {Promise<string>} 生成的提交消息
 */
export async function generateCommitMessage(projectPath, files, provider = 'claude') {
    // 收集 diff 上下文
    let diffContext = '';
    for (const file of files) {
        try {
            const { stdout } = await execAsync(`git diff HEAD -- "${file}"`, { cwd: projectPath });
            if (stdout) diffContext += `\n--- ${file} ---\n${stdout}`;
        } catch { /* ignore */ }
    }

    // 未跟踪文件：读取文件内容
    if (!diffContext.trim()) {
        for (const file of files) {
            try {
                const filePath = path.join(projectPath, file);
                const stats = await fs.stat(filePath);
                if (!stats.isDirectory()) {
                    const content = await fs.readFile(filePath, 'utf-8');
                    diffContext += `\n--- ${file} (new file) ---\n${content.substring(0, 1000)}\n`;
                } else {
                    diffContext += `\n--- ${file} (new directory) ---\n`;
                }
            } catch { /* ignore */ }
        }
    }

    const prompt = `Generate a conventional commit message for these changes.

REQUIREMENTS:
- Format: type(scope): subject
- Include body explaining what changed and why
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Subject under 50 chars, body wrapped at 72 chars
- Focus on user-facing changes, not implementation details
- Consider what's being added AND removed
- Return ONLY the commit message (no markdown, explanations, or code blocks)

FILES CHANGED:
${files.map(f => `- ${f}`).join('\n')}

DIFFS:
${diffContext.substring(0, 4000)}

Generate the commit message:`;

    try {
        let responseText = '';
        const writer = {
            send: (data) => {
                try {
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                    if (parsed.type === 'claude-response' && parsed.data) {
                        const message = parsed.data.message || parsed.data;
                        if (message.content && Array.isArray(message.content)) {
                            for (const item of message.content) {
                                if (item.type === 'text' && item.text) responseText += item.text;
                            }
                        }
                    } else if (parsed.type === 'cursor-output' && parsed.output) {
                        responseText += parsed.output;
                    } else if (parsed.type === 'text' && parsed.text) {
                        responseText += parsed.text;
                    }
                } catch { /* ignore parse errors */ }
            },
            setSessionId: () => {},
        };

        if (provider === 'claude') {
            await queryClaudeSDK(prompt, { cwd: projectPath, permissionMode: 'bypassPermissions', model: 'sonnet' }, writer);
        } else if (provider === 'cursor') {
            await spawnCursor(prompt, { cwd: projectPath, skipPermissions: true }, writer);
        }

        const cleaned = cleanCommitMessage(responseText);
        return cleaned || 'chore: update files';
    } catch (error) {
        logger.error({ err: error }, '[git] Error generating commit message with AI');
        return `chore: update ${files.length} file${files.length !== 1 ? 's' : ''}`;
    }
}

// ─── 工具函数 ──────────────────────────────────────────

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

/**
 * 清理 AI 生成的提交消息
 * @param {string} text - 原始文本
 * @returns {string} 清理后的提交消息
 */
export function cleanCommitMessage(text) {
    if (!text || !text.trim()) return '';

    let cleaned = text.trim();
    cleaned = cleaned.replace(/```[a-z]*\n/g, '').replace(/```/g, '');
    cleaned = cleaned.replace(/^#+\s*/gm, '');
    cleaned = cleaned.replace(/^["']|["']$/g, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    const match = cleaned.match(/(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+?\))?:.+/s);
    if (match) cleaned = cleaned.substring(cleaned.indexOf(match[0]));

    return cleaned.trim();
}
