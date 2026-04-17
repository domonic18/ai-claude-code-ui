/**
 * Git 提交操作模块
 *
 * 提供创建初始提交、提交文件、切换/创建分支等写操作。
 *
 * @module services/scm/gitCommit
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { validateRepository } from './gitValidator.js';
import { createLogger, sanitizePreview } from '../../utils/logger.js';
import { queryClaudeSDK } from '../execution/claude/index.js';
import { spawnCursor } from '../execution/cursor/index.js';

const logger = createLogger('services/scm/gitCommit');
const execAsync = promisify(exec);

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
