/**
 * File Path Security Helpers
 * ==========================
 *
 * Path validation and security helpers for file operations.
 * Extracted from BaseFileAdapter.js to reduce complexity.
 *
 * @module files/adapters/filePathSecurity
 */

import {
  ERROR_TYPES,
  ERROR_MESSAGES
} from '../constants.js';
import { CONTAINER } from '../../../config/config.js';
import { PathUtils } from '../../core/utils/path-utils.js';
import { normalizePath } from '../utils/file-utils.js';

// FileAdapter._validatePath 在所有文件操作之前调用此函数以防止路径遍历
/**
 * Validate path security
 *
 * @param {string} filePath - File path
 * @param {Object} options - Options
 * @returns {Object} { valid: boolean, error: string|null, safePath: string }
 */
export function validatePath(filePath, options = {}) {
  // 基本路径验证
  if (!filePath || typeof filePath !== 'string') {
    return {
      valid: false,
      error: ERROR_MESSAGES[ERROR_TYPES.INVALID_PATH].replace('{path}', filePath || 'empty'),
      safePath: ''
    };
  }

  // 检查路径遍历攻击 - 使用更严格的验证
  // 1. 检查原始 .. 模式
  if (filePath.includes('..')) {
    return {
      valid: false,
      error: ERROR_MESSAGES[ERROR_TYPES.PATH_TRAVERSAL].replace('{path}', filePath),
      safePath: ''
    };
  }

  // 2. 检查 URL 编码的路径遍历尝试
  try {
    const decodedPath = decodeURIComponent(filePath);
    if (decodedPath.includes('..')) {
      return {
        valid: false,
        error: ERROR_MESSAGES[ERROR_TYPES.PATH_TRAVERSAL].replace('{path}', filePath),
        safePath: ''
      };
    }
  } catch (e) {
    // URI 解码失败，视为无效路径
    return {
      valid: false,
      error: ERROR_MESSAGES[ERROR_TYPES.INVALID_PATH].replace('{path}', filePath),
      safePath: ''
    };
  }

  // 3. 检查空字节注入
  if (filePath.includes('\0')) {
    return {
      valid: false,
      error: ERROR_MESSAGES[ERROR_TYPES.PATH_TRAVERSAL].replace('{path}', filePath),
      safePath: ''
    };
  }

  return { valid: true, error: null, safePath: filePath };
}

// FileReader、FileWriter 和 FileTreeBuilder 使用此函数将用户路径转换为容器路径
/**
 * Resolve container path
 * Parse and standardize container paths, handling both relative and absolute paths
 *
 * @param {string} filePath - Raw file path
 * @param {Object} options - Options
 * @param {string} options.projectPath - Project path
 * @param {boolean} options.isContainerProject - Whether it's a container project
 * @returns {string} Complete container path
 * @throws {Error} If path validation fails
 */
export function resolveContainerPath(filePath, options = {}) {
  const { projectPath = '', isContainerProject = false } = options;

  // 清理路径中的 ./ 和 //
  let cleanPath = normalizePath(filePath);

  // 检查是否为绝对路径（以 /workspace 开头）
  if (cleanPath.startsWith('/workspace')) {
    // 验证路径安全性
    if (cleanPath.includes('..')) {
      throw new Error('Path traversal detected');
    }
    return cleanPath;
  }

  // 相对路径处理
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.substring(1);
  }

  // 验证路径
  const validation = validatePath(cleanPath, options);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 构建容器路径
  return buildContainerPath(validation.safePath, { projectPath, isContainerProject });
}

// resolveContainerPath 使用此函数构建最终的 /workspace 或 /projects 路径
/**
 * Build container path
 *
 * @param {string} safePath - Safe path
 * @param {Object} options - Options
 * @param {string} options.projectPath - Project path
 * @param {boolean} options.isContainerProject - Whether it's a container project
 * @returns {string} Container path
 */
export function buildContainerPath(safePath, options = {}) {
  const { projectPath = '', isContainerProject = false } = options;

  // 处理当前目录 '.' 的情况
  const processedSafePath = (safePath === '.' || safePath === './') ? '' : safePath;

  let path;
  if (isContainerProject && projectPath) {
    // 容器项目：项目代码位于 /workspace 下
    path = processedSafePath
      ? `${CONTAINER.paths.workspace}/${projectPath}/${processedSafePath}`
      : `${CONTAINER.paths.workspace}/${projectPath}`;
  } else if (projectPath) {
    // 会话项目：使用 .claude/projects
    path = processedSafePath
      ? `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}/${processedSafePath}`
      : `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}`;
  } else {
    // 默认：workspace
    path = processedSafePath
      ? `${CONTAINER.paths.workspace}/${processedSafePath}`
      : CONTAINER.paths.workspace;
  }

  return path.replace(/\/+/g, '/');
}
