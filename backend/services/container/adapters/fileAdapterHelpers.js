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
 * Builds file tree structure from list of paths
 * @param {Array<string>} paths - Array of file paths
 * @param {string} basePath - Base path for the tree
 * @returns {Array} File tree structure
 */
export function buildFileTree(paths, basePath) {
  const tree = [];

  for (const fullPath of paths) {
    if (!fullPath || fullPath.trim() === '') {
      continue;
    }

    const relativePath = fullPath.startsWith(basePath)
      ? fullPath.substring(basePath.length).replace(/^\//, '') || '.'
      : fullPath;

    const pathParts = relativePath.split('/');

    if (pathParts.some(part => isHiddenFile(part))) {
      continue;
    }

    const parts = relativePath.split('/').map(cleanFileName);

    if (parts.some(part => part === '' || !isValidFileName(part))) {
      logger.info('[fileAdapterHelpers] Skipping invalid path:', relativePath, '->', parts);
      continue;
    }

    let currentLevel = tree;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      const fullPathForCheck = `${basePath}/${currentPath}`;
      const isDir = isDirectory(fullPathForCheck, new Set(paths));

      let existingNode = currentLevel.find(node => node.name === part);

      if (!existingNode) {
        existingNode = {
          name: part,
          path: fullPathForCheck,
          type: isDir ? 'directory' : 'file',
          children: isDir ? [] : undefined
        };
        currentLevel.push(existingNode);
      }

      if (existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  return tree;
}
