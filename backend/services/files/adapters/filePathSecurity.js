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

/**
 * Validate path security
 *
 * @param {string} filePath - File path
 * @param {Object} options - Options
 * @returns {Object} { valid: boolean, error: string|null, safePath: string }
 */
export function validatePath(filePath, options = {}) {
  // Basic path validation
  if (!filePath || typeof filePath !== 'string') {
    return {
      valid: false,
      error: ERROR_MESSAGES[ERROR_TYPES.INVALID_PATH].replace('{path}', filePath || 'empty'),
      safePath: ''
    };
  }

  // Check for path traversal attacks - use stricter validation
  // 1. Check for raw .. patterns
  if (filePath.includes('..')) {
    return {
      valid: false,
      error: ERROR_MESSAGES[ERROR_TYPES.PATH_TRAVERSAL].replace('{path}', filePath),
      safePath: ''
    };
  }

  // 2. Check for URL-encoded path traversal attempts
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
    // URI decode failed, treat as invalid path
    return {
      valid: false,
      error: ERROR_MESSAGES[ERROR_TYPES.INVALID_PATH].replace('{path}', filePath),
      safePath: ''
    };
  }

  // 3. Check for null byte injection
  if (filePath.includes('\0')) {
    return {
      valid: false,
      error: ERROR_MESSAGES[ERROR_TYPES.PATH_TRAVERSAL].replace('{path}', filePath),
      safePath: ''
    };
  }

  return { valid: true, error: null, safePath: filePath };
}

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

  // Clean ./ and // from path
  let cleanPath = normalizePath(filePath);

  // Check if it's an absolute path (starts with /workspace)
  if (cleanPath.startsWith('/workspace')) {
    // Validate path security
    if (cleanPath.includes('..')) {
      throw new Error('Path traversal detected');
    }
    return cleanPath;
  }

  // Relative path handling
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.substring(1);
  }

  // Validate path
  const validation = validatePath(cleanPath, options);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Build container path
  return buildContainerPath(validation.safePath, { projectPath, isContainerProject });
}

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

  // Handle current directory '.' case
  const processedSafePath = (safePath === '.' || safePath === './') ? '' : safePath;

  let path;
  if (isContainerProject && projectPath) {
    // Container project: project code is under /workspace
    path = processedSafePath
      ? `${CONTAINER.paths.workspace}/${projectPath}/${processedSafePath}`
      : `${CONTAINER.paths.workspace}/${projectPath}`;
  } else if (projectPath) {
    // Session project: use .claude/projects
    path = processedSafePath
      ? `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}/${processedSafePath}`
      : `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}`;
  } else {
    // Default: workspace
    path = processedSafePath
      ? `${CONTAINER.paths.workspace}/${processedSafePath}`
      : CONTAINER.paths.workspace;
  }

  return path.replace(/\/+/g, '/');
}
