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
import { checkForbiddenPath, resolveRealPath } from './pathValidatorHelpers.js';

const WORKSPACES_ROOT = process.env.WORKSPACES_ROOT || os.homedir();

// 在路径验证时调用，检查路径是否在允许的工作空间根目录范围内
// path-validator.js 功能函数
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

// 在验证符号链接时调用，确保链接目标不会逃逸工作空间根目录
// path-validator.js 功能函数
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

// 在创建或访问工作区前调用，验证路径安全性并防止路径遍历攻击
// path-validator.js 功能函数
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

// path-validator.js 功能函数
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

// path-validator.js 功能函数
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
