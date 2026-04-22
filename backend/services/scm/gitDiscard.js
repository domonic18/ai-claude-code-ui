/**
 * Git 丢弃更改模块
 *
 * 负责丢弃文件更改和删除未跟踪文件。
 *
 * @module services/scm/gitDiscard
 */

import path from 'path';
import { promises as fs } from 'fs';
import { validateRepository } from './gitValidator.js';
import { gitSpawn } from './gitSpawn.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/scm/gitDiscard');

// 在丢弃更改时调用，执行 git checkout
/**
 * 丢弃指定文件的更改
 * @param {string} projectPath - 项目路径
 * @param {string} file - 文件路径
 * @returns {Promise<void>}
 */
export async function discardChanges(projectPath, file) {
  await validateRepository(projectPath);

  const { stdout: statusOutput } = await gitSpawn(['status', '--porcelain', '--', file], projectPath);
  if (!statusOutput.trim()) throw new Error('No changes to discard for this file');

  const status = statusOutput.substring(0, 2);
  if (status === '??') {
    const filePath = path.join(projectPath, file);
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) await fs.rm(filePath, { recursive: true, force: true });
    else await fs.unlink(filePath);
  } else if (status.includes('M') || status.includes('D')) {
    await gitSpawn(['restore', '--', file], projectPath);
  } else if (status.includes('A')) {
    await gitSpawn(['reset', 'HEAD', '--', file], projectPath);
  }
}

// gitDiscard.js 功能函数
/**
 * 删除未跟踪的文件
 * @param {string} projectPath - 项目路径
 * @param {string} file - 文件路径
 * @returns {Promise<boolean>} 是否为目录
 */
export async function deleteUntracked(projectPath, file) {
  await validateRepository(projectPath);

  const { stdout: statusOutput } = await gitSpawn(['status', '--porcelain', '--', file], projectPath);
  if (!statusOutput.trim()) throw new Error('File is not untracked or does not exist');
  if (statusOutput.substring(0, 2) !== '??') throw new Error('File is not untracked. Use discard for tracked files.');

  const filePath = path.join(projectPath, file);
  const stats = await fs.stat(filePath);
  const isDir = stats.isDirectory();

  if (isDir) await fs.rm(filePath, { recursive: true, force: true });
  else await fs.unlink(filePath);

  return isDir;
}
