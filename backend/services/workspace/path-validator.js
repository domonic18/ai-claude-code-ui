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

/**
 * 配置允许的工作空间根目录（默认为用户主目录）
 */
const WORKSPACES_ROOT = process.env.WORKSPACES_ROOT || os.homedir();

/**
 * 不应作为工作空间目录的系统关键路径
 */
const FORBIDDEN_PATHS = [
  '/',
  '/etc',
  '/bin',
  '/sbin',
  '/usr',
  '/dev',
  '/proc',
  '/sys',
  '/var',
  '/boot',
  '/root',
  '/lib',
  '/lib64',
  '/opt',
  '/tmp',
  '/run'
];

/**
 * 路径验证结果
 * @typedef {Object} PathValidationResult
 * @property {boolean} valid - 路径是否有效
 * @property {string} [resolvedPath] - 解析后的绝对路径
 * @property {string} [error] - 错误信息
 */

/**
 * 验证路径对工作空间操作是否安全
 *
 * @param {string} requestedPath - 要验证的路径
 * @returns {Promise<PathValidationResult>}
 */
export async function validateWorkspacePath(requestedPath) {
  try {
    // 解析为绝对路径
    let absolutePath = path.resolve(requestedPath);

    // 检查路径是否为禁止的系统目录
    const normalizedPath = path.normalize(absolutePath);
    if (FORBIDDEN_PATHS.includes(normalizedPath) || normalizedPath === '/') {
      return {
        valid: false,
        error: 'Cannot use system-critical directories as workspace locations'
      };
    }

    // 对以禁止目录开头的路径进行额外检查
    for (const forbidden of FORBIDDEN_PATHS) {
      if (normalizedPath === forbidden ||
          normalizedPath.startsWith(forbidden + path.sep)) {
        // 例外：/var/tmp 和类似用户可访问的路径可能被允许
        if (forbidden === '/var' &&
            (normalizedPath.startsWith('/var/tmp') ||
             normalizedPath.startsWith('/var/folders'))) {
          continue;
        }

        return {
          valid: false,
          error: `Cannot create workspace in system directory: ${forbidden}`
        };
      }
    }

    // 尝试解析真实路径（跟随符号链接）
    let realPath;
    try {
      await fs.access(absolutePath);
      realPath = await fs.realpath(absolutePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 路径尚不存在 - 检查父目录
        let parentPath = path.dirname(absolutePath);
        try {
          const parentRealPath = await fs.realpath(parentPath);
          realPath = path.join(parentRealPath, path.basename(absolutePath));
        } catch (parentError) {
          if (parentError.code === 'ENOENT') {
            realPath = absolutePath;
          } else {
            throw parentError;
          }
        }
      } else {
        throw error;
      }
    }

    // 将工作空间根目录解析为其真实路径
    const resolvedWorkspaceRoot = await fs.realpath(WORKSPACES_ROOT);

    // 确保解析的路径包含在允许的工作空间根目录内
    if (!realPath.startsWith(resolvedWorkspaceRoot + path.sep) &&
        realPath !== resolvedWorkspaceRoot) {
      return {
        valid: false,
        error: `Workspace path must be within the allowed workspace root: ${WORKSPACES_ROOT}`
      };
    }

    // 对现有路径进行额外的符号链接检查
    try {
      await fs.access(absolutePath);
      const stats = await fs.lstat(absolutePath);

      if (stats.isSymbolicLink()) {
        const linkTarget = await fs.readlink(absolutePath);
        const resolvedTarget = path.resolve(path.dirname(absolutePath), linkTarget);
        const realTarget = await fs.realpath(resolvedTarget);

        if (!realTarget.startsWith(resolvedWorkspaceRoot + path.sep) &&
            realTarget !== resolvedWorkspaceRoot) {
          return {
            valid: false,
            error: 'Symlink target is outside the allowed workspace root'
          };
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    return {
      valid: true,
      resolvedPath: realPath
    };

  } catch (error) {
    return {
      valid: false,
      error: `Path validation failed: ${error.message}`
    };
  }
}

/**
 * 验证现有工作空间路径
 *
 * @param {string} workspacePath - 工作空间路径
 * @returns {Promise<PathValidationResult>}
 */
export async function validateExistingWorkspace(workspacePath) {
  const validation = await validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    return validation;
  }

  const absolutePath = validation.resolvedPath;

  // 检查路径是否存在
  try {
    await fs.access(absolutePath);
    const stats = await fs.stat(absolutePath);

    if (!stats.isDirectory()) {
      return {
        valid: false,
        error: 'Path exists but is not a directory'
      };
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        valid: false,
        error: 'Workspace path does not exist'
      };
    }
    throw error;
  }

  return { valid: true, resolvedPath: absolutePath };
}

/**
 * 验证新工作空间路径（路径不应已存在）
 *
 * @param {string} workspacePath - 工作空间路径
 * @returns {Promise<PathValidationResult>}
 */
export async function validateNewWorkspace(workspacePath) {
  const validation = await validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    return validation;
  }

  const absolutePath = validation.resolvedPath;

  // 检查路径是否已存在
  try {
    await fs.access(absolutePath);
    return {
      valid: false,
      error: 'Path already exists. Please choose a different path or use "existing workspace" option.'
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    // 路径不存在 - 很好，我们可以创建它
  }

  return { valid: true, resolvedPath: absolutePath };
}
