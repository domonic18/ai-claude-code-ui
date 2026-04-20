/**
 * Git Diff Operations
 *
 * 提供文件 diff 获取和文件内容提取功能
 *
 * @module services/scm/gitDiffOperations
 */

import path from 'path';
import { promises as fs } from 'fs';
import { validateRepository } from './gitValidator.js';
import { gitSpawn } from './gitSpawn.js';
import { stripDiffHeaders } from './gitStatusParser.js';

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
