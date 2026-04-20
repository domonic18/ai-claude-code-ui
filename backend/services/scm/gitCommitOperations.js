/**
 * Git 提交操作模块
 *
 * 负责创建提交、分支切换和 AI 生成提交消息。
 *
 * @module services/scm/gitCommitOperations
 */

import { validateRepository } from './gitValidator.js';
import { gitSpawn } from './gitSpawn.js';
import {
  collectDiffContext,
  collectUntrackedFileContent,
  createCommitPrompt
} from './gitCommitContext.js';
import {
  generateCommitMessage as aiGenerateCommitMessage,
  cleanCommitMessage
} from './gitCommitAI.js';

// Re-export for downstream consumers
export { cleanCommitMessage } from './gitCommitAI.js';

/**
 * 创建初始提交
 * @param {string} projectPath - 项目路径
 * @returns {Promise<{output: string}>}
 */
export async function createInitialCommit(projectPath) {
  await validateRepository(projectPath);

  try {
    await gitSpawn(['rev-parse', 'HEAD'], projectPath);
    throw new Error('Repository already has commits. Use regular commit instead.');
  } catch (error) {
    if (error.message.includes('already has commits')) throw error;
  }

  await gitSpawn(['add', '.'], projectPath);
  const { stdout } = await gitSpawn(['commit', '-m', 'Initial commit'], projectPath);
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
    await gitSpawn(['add', '--', file], projectPath);
  }

  const { stdout } = await gitSpawn(['commit', '-m', message], projectPath);
  return { output: stdout };
}

/**
 * 切换分支
 * @param {string} projectPath - 项目路径
 * @param {string} branch - 目标分支
 * @returns {Promise<{output: string}>}
 */
export async function checkoutBranch(projectPath, branch) {
  const { stdout } = await gitSpawn(['checkout', branch], projectPath);
  return { output: stdout };
}

/**
 * 创建并切换到新分支
 * @param {string} projectPath - 项目路径
 * @param {string} branch - 新分支名称
 * @returns {Promise<{output: string}>}
 */
export async function createBranch(projectPath, branch) {
  const { stdout } = await gitSpawn(['checkout', '-b', branch], projectPath);
  return { output: stdout };
}

/**
 * 使用 AI 生成提交消息
 * @param {string} projectPath - 项目路径
 * @param {string[]} files - 文件列表
 * @param {string} provider - AI 提供者：'claude' 或 'cursor'
 * @returns {Promise<string>} 生成的提交消息
 */
export async function generateCommitMessage(projectPath, files, provider = 'claude') {
  return aiGenerateCommitMessage(
    projectPath,
    files,
    provider,
    collectDiffContext,
    collectUntrackedFileContent,
    createCommitPrompt
  );
}
