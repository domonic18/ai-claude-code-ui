/**
 * 工作空间路径验证服务
 *
 * 负责验证工作空间路径的安全性，防止路径遍历攻击和系统目录访问。
 *
 * @module services/workspace/path-validator
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const WORKSPACES_ROOT = process.env.WORKSPACES_ROOT || os.homedir();

/** 不应作为工作空间目录的系统关键路径 */
const FORBIDDEN_PATHS = [
  '/', '/etc', '/bin', '/sbin', '/usr', '/dev', '/proc', '/sys',
  '/var', '/boot', '/root', '/lib', '/lib64', '/opt', '/tmp', '/run',
];

/** /var 下的用户可访问子路径例外 */
const VAR_EXCEPTIONS = ['/var/tmp', '/var/folders'];

/**
 * 检查路径是否为禁止的系统目录
 * @param {string} normalizedPath - 标准化后的路径
 * @returns {string|null} 错误信息，无错误返回 null
 */
function checkForbiddenPath(normalizedPath) {
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

/**
 * 解析路径的真实路径（处理不存在的路径和符号链接）
 * @param {string} absolutePath - 绝对路径
 * @returns {Promise<string>} 解析后的真实路径
 */
async function resolveRealPath(absolutePath) {
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

/**
 * 检查路径是否在工作空间根目录内
 * @param {string} realPath - 解析后的真实路径
 * @param {string} workspaceRoot - 工作空间根目录
 * @returns {string|null} 错误信息，无错误返回 null
 */
function checkWithinWorkspace(realPath, workspaceRoot) {
  if (!realPath.startsWith(workspaceRoot + path.sep) && realPath !== workspaceRoot) {
    return `Workspace path must be within the allowed workspace root: ${WORKSPACES_ROOT}`;
  }
  return null;
}

/**
 * 检查符号链接目标是否在工作空间内
 * @param {string} absolutePath - 绝对路径
 * @param {string} workspaceRoot - 工作空间根目录真实路径
 * @returns {Promise<string|null>} 错误信息，无错误返回 null
 */
async function checkSymlinkSafety(absolutePath, workspaceRoot) {
  try {
    await fs.access(absolutePath);
    const stats = await fs.lstat(absolutePath);

    if (stats.isSymbolicLink()) {
      const linkTarget = await fs.readlink(absolutePath);
      const resolvedTarget = path.resolve(path.dirname(absolutePath), linkTarget);
      const realTarget = await fs.realpath(resolvedTarget);
      return checkWithinWorkspace(realTarget, workspaceRoot);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return null;
}

/**
 * 验证路径对工作空间操作是否安全
 * @param {string} requestedPath - 要验证的路径
 * @returns {Promise<{valid: boolean, resolvedPath?: string, error?: string}>}
 */
export async function validateWorkspacePath(requestedPath) {
  try {
    const absolutePath = path.resolve(requestedPath);
    const normalizedPath = path.normalize(absolutePath);

    const forbiddenError = checkForbiddenPath(normalizedPath);
    if (forbiddenError) return { valid: false, error: forbiddenError };

    const realPath = await resolveRealPath(absolutePath);
    const resolvedWorkspaceRoot = await fs.realpath(WORKSPACES_ROOT);

    const workspaceError = checkWithinWorkspace(realPath, resolvedWorkspaceRoot);
    if (workspaceError) return { valid: false, error: workspaceError };

    const symlinkError = await checkSymlinkSafety(absolutePath, resolvedWorkspaceRoot);
    if (symlinkError) return { valid: false, error: symlinkError };

    return { valid: true, resolvedPath: realPath };
  } catch (error) {
    return { valid: false, error: `Path validation failed: ${error.message}` };
  }
}

/**
 * 验证现有工作空间路径
 * @param {string} workspacePath - 工作空间路径
 * @returns {Promise<{valid: boolean, resolvedPath?: string, error?: string}>}
 */
export async function validateExistingWorkspace(workspacePath) {
  const validation = await validateWorkspacePath(workspacePath);
  if (!validation.valid) return validation;

  try {
    const stats = await fs.stat(validation.resolvedPath);
    if (!stats.isDirectory()) return { valid: false, error: 'Path exists but is not a directory' };
  } catch (error) {
    if (error.code === 'ENOENT') return { valid: false, error: 'Workspace path does not exist' };
    throw error;
  }

  return { valid: true, resolvedPath: validation.resolvedPath };
}

/**
 * 验证新工作空间路径（路径不应已存在）
 * @param {string} workspacePath - 工作空间路径
 * @returns {Promise<{valid: boolean, resolvedPath?: string, error?: string}>}
 */
export async function validateNewWorkspace(workspacePath) {
  const validation = await validateWorkspacePath(workspacePath);
  if (!validation.valid) return validation;

  try {
    await fs.access(validation.resolvedPath);
    return { valid: false, error: 'Path already exists. Please choose a different path or use "existing workspace" option.' };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return { valid: true, resolvedPath: validation.resolvedPath };
}
