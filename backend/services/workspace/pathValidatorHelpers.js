/**
 * Path Validator Helper Functions
 *
 * 内部辅助函数，用于路径验证和解析
 *
 * @module services/workspace/pathValidatorHelpers
 */

import { promises as fs } from 'fs';
import path from 'path';

/** 不应作为工作空间目录的系统关键路径 */
const FORBIDDEN_PATHS = [
  '/', '/etc', '/bin', '/sbin', '/usr', '/dev', '/proc', '/sys',
  '/var', '/boot', '/root', '/lib', '/lib64', '/opt', '/tmp', '/run',
];

/** /var 下的用户可访问子路径例外 */
const VAR_EXCEPTIONS = ['/var/tmp', '/var/folders'];

// pathValidatorHelpers.js 功能函数
/**
 * 检查路径是否为禁止的系统目录
 * @param {string} normalizedPath - 标准化后的路径
 * @returns {string|null} 错误信息，无错误返回 null
 */
export function checkForbiddenPath(normalizedPath) {
  if (FORBIDDEN_PATHS.includes(normalizedPath) || normalizedPath === '/') {
    return 'Cannot use system-critical directories as workspace locations';
  }

  for (const forbidden of FORBIDDEN_PATHS) {
    if (normalizedPath === forbidden || normalizedPath.startsWith(forbidden + path.sep)) {
      if (forbidden === '/var' && VAR_EXCEPTIONS.some(e => normalizedPath.startsWith(e))) {
        continue;
      }
      return `Cannot create workspace in system directory: ${forbidden}`;
    }
  }
  return null;
}

// pathValidatorHelpers.js 功能函数
/**
 * 解析路径的真实路径（处理不存在的路径和符号链接）
 * @param {string} absolutePath - 绝对路径
 * @returns {Promise<string>} 解析后的真实路径
 */
export async function resolveRealPath(absolutePath) {
  try {
    await fs.access(absolutePath);
    return await fs.realpath(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;

    // 路径不存在 - 尝试解析父目录
    const parentPath = path.dirname(absolutePath);
    try {
      const parentRealPath = await fs.realpath(parentPath);
      return path.join(parentRealPath, path.basename(absolutePath));
    } catch (parentError) {
      if (parentError.code === 'ENOENT') return absolutePath;
      throw parentError;
    }
  }
}
