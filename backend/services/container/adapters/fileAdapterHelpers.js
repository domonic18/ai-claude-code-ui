/**
 * File Adapter Helpers
 *
 * Helper functions for FileAdapter including path conversion,
 * stat parsing, and file tree building
 *
 * @module services/container/adapters/fileAdapterHelpers
 */

import { CONTAINER } from '../../../config/config.js';
import {
  cleanFileName,
  isValidFileName,
  isHiddenFile,
  isDirectory
} from '../../files/utils/file-utils.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/container/adapters/fileAdapterHelpers');

/**
 * Converts user file path to container path
 * @param {string} filePath - User file path
 * @returns {string} Container path
 */
export function toContainerPath(filePath) {
  if (filePath.startsWith('/')) {
    return filePath;
  }

  return `${CONTAINER.paths.workspace}/${filePath}`;
}

/**
 * Parses stat command output into file stats object
 * @param {string} output - Stat command output
 * @param {string} filePath - Original file path
 * @returns {Object} Parsed file stats
 */
export function parseStatOutput(output, filePath) {
  const lines = output.split('\n');
  const stats = {
    path: filePath,
    size: 0,
    type: 'unknown',
    modified: null,
    permissions: null
  };

  for (const line of lines) {
    if (line.includes('Size:')) {
      const match = line.match(/Size:\s+(\d+)/);
      if (match) stats.size = parseInt(match[1], 10);
    }
    if (line.includes('Modify:')) {
      const match = line.match(/Modify:\s+(.+)/);
      if (match) stats.modified = match[1].trim();
    }
  }

  return stats;
}

/**
 * Check if a relative path should be skipped (hidden or invalid)
 * @param {string} relativePath - Relative path to check
 * @returns {string[]|null} Cleaned path parts, or null to skip
 */
function validateRelativePath(relativePath) {
  const pathParts = relativePath.split('/');
  if (pathParts.some(part => isHiddenFile(part))) return null;

  const parts = relativePath.split('/').map(cleanFileName);
  if (parts.some(part => part === '' || !isValidFileName(part))) {
    logger.info('[fileAdapterHelpers] Skipping invalid path:', relativePath, '->', parts);
    return null;
  }
  return parts;
}

/**
 * Insert a single path's parts into the tree structure
 * @param {Array} tree - Root tree array
 * @param {string[]} parts - Cleaned path parts
 * @param {string} basePath - Base path prefix
 * @param {Set<string>} paths - All paths set for directory detection
 */
function insertPathIntoTree(tree, parts, basePath, paths) {
  let currentLevel = tree;
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const fullPathForCheck = `${basePath}/${currentPath}`;
    const isDir = isDirectory(fullPathForCheck, paths);

    let node = currentLevel.find(n => n.name === part);
    if (!node) {
      node = {
        name: part,
        path: fullPathForCheck,
        type: isDir ? 'directory' : 'file',
        children: isDir ? [] : undefined
      };
      currentLevel.push(node);
    }

    if (node.children) {
      currentLevel = node.children;
    }
  }
}

/**
 * Builds file tree structure from list of paths
 * @param {Array<string>} paths - Array of file paths
 * @param {string} basePath - Base path for the tree
 * @returns {Array} File tree structure
 */
export function buildFileTree(paths, basePath) {
  const tree = [];

  for (const fullPath of paths) {
    if (!fullPath || fullPath.trim() === '') continue;

    const relativePath = fullPath.startsWith(basePath)
      ? fullPath.substring(basePath.length).replace(/^\//, '') || '.'
      : fullPath;

    const parts = validateRelativePath(relativePath);
    if (!parts) continue;

    insertPathIntoTree(tree, parts, basePath, new Set(paths));
  }

  return tree;
}
