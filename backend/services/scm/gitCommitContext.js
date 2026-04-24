/**
 * Git 提交上下文收集模块
 *
 * 负责收集 diff 和文件内容作为 AI 生成提交消息的上下文
 *
 * @module services/scm/gitCommitContext
 */

import path from 'path';
import { promises as fs } from 'fs';
import { gitSpawn } from './gitSpawn.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/scm/gitCommitContext');

// gitCommitContext.js 功能函数
/**
 * 收集已跟踪文件的 diff 上下文
 * @param {string} projectPath - 项目路径
 * @param {string[]} files - 文件列表
 * @returns {Promise<string>} diff 内容
 */
export async function collectDiffContext(projectPath, files) {
  let diffContext = '';
  for (const file of files) {
    try {
      const { stdout } = await gitSpawn(['diff', 'HEAD', '--', file], projectPath);
      if (stdout) diffContext += `\n--- ${file} ---\n${stdout}`;
    } catch {
      logger.debug({ file }, 'Failed to get diff for file');
    }
  }
  return diffContext;
}

// gitCommitContext.js 功能函数
/**
 * 收集未跟踪文件的内容作为上下文
 * @param {string} projectPath - 项目路径
 * @param {string[]} files - 文件列表
 * @returns {Promise<string>} 文件内容
 */
export async function collectUntrackedFileContent(projectPath, files) {
  let content = '';
  const resolvedProject = path.resolve(projectPath);

  for (const file of files) {
    try {
      const filePath = path.resolve(projectPath, file);
      // 防止路径穿越：确保解析后的路径仍在项目目录内
      if (!filePath.startsWith(resolvedProject + path.sep) && filePath !== resolvedProject) {
        logger.warn({ file }, 'Path traversal detected in untracked file');
        continue;
      }
      const stats = await fs.stat(filePath);
      if (!stats.isDirectory()) {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        content += `\n--- ${file} (new file) ---\n${fileContent.substring(0, 1000)}\n`;
      } else {
        content += `\n--- ${file} (new directory) ---\n`;
      }
    } catch {
      logger.debug({ file }, 'Failed to read untracked file');
    }
  }
  return content;
}

// gitCommitContext.js 功能函数
/**
 * 构建 AI 提交消息生成 prompt
 * @param {string[]} files - 文件列表
 * @param {string} diffContext - diff 上下文
 * @returns {string} prompt 文本
 */
export function createCommitPrompt(files, diffContext) {
  return `Generate a conventional commit message for these changes.

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
}
