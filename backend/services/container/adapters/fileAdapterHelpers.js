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
 * Create default stats object for a file path
 * @param {string} filePath - File path
 * @returns {Object} Default stats object
 */
function createDefaultStats(filePath) {
  return {
    path: filePath,
    size: 0,
    type: 'unknown',
    modified: null,
    permissions: null
  };
}

/**
 * Try to extract a matched number from a stat line
 * @param {string} line - Line to parse
 * @param {RegExp} pattern - Regex with capture group
 * @returns {number|null} Parsed number or null
 */
function extractMatchedNumber(line, pattern) {
  const match = line.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Try to extract matched text from a stat line
 * @param {string} line - Line to parse
 * @param {RegExp} pattern - Regex with capture group
 * @returns {string|null} Matched text or null
 */
function extractMatchedText(line, pattern) {
  const match = line.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Apply stat Size field extraction
 * @param {Object} stats - Stats object to update
 * @param {string} line - Single line from stat output
 */
function applySizeLine(stats, line) {
  const size = extractMatchedNumber(line, /Size:\s+(\d+)/);
  if (size !== null) stats.size = size;
}

/**
 * Apply stat Modify field extraction
 * @param {Object} stats - Stats object to update
 * @param {string} line - Single line from stat output
 */
function applyModifyLine(stats, line) {
  const modified = extractMatchedText(line, /Modify:\s+(.+)/);
  if (modified !== null) stats.modified = modified;
}

/**
 * Apply stat field extraction from a single line to stats object
 * @param {Object} stats - Stats object to update
 * @param {string} line - Single line from stat output
 */
function applyStatLine(stats, line) {
  if (line.includes('Size:')) applySizeLine(stats, line);
  if (line.includes('Modify:')) applyModifyLine(stats, line);
}

/**
 * Parses stat command output into file stats object
 * @param {string} output - Stat command output
 * @param {string} filePath - Original file path
 * @returns {Object} Parsed file stats
 */
export function parseStatOutput(output, filePath) {
  const stats = createDefaultStats(filePath);
  output.split('\n').forEach(line => applyStatLine(stats, line));
  return stats;
}

/**
 * Check if a path part is invalid (empty or bad filename)
 * @param {string} part - Path segment to check
 * @returns {boolean} True if invalid
 */
function isInvalidPart(part) {
  return part === '' || !isValidFileName(part);
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
  if (parts.some(isInvalidPart)) {
    logger.info('[fileAdapterHelpers] Skipping invalid path:', relativePath, '->', parts);
    return null;
  }
  return parts;
}

/**
 * Create a tree node for a given path part
 * @param {string} part - Path segment name
 * @param {string} fullPath - Full path for this segment
 * @param {boolean} isDir - Whether this is a directory
 * @returns {Object} Tree node
 */
function createTreeNode(part, fullPath, isDir) {
  return {
    name: part,
    path: fullPath,
    type: isDir ? 'directory' : 'file',
    children: isDir ? [] : undefined
  };
}

/**
 * Find or create a tree node at the current level
 * @param {Array} currentLevel - Current level of tree nodes
 * @param {string} part - Path segment name
 * @param {string} fullPath - Full path for this segment
 * @param {boolean} isDir - Whether this is a directory
 * @returns {Object} The found or created node
 */
function findOrCreateNode(currentLevel, part, fullPath, isDir) {
  let node = currentLevel.find(n => n.name === part);
  if (!node) {
    node = createTreeNode(part, fullPath, isDir);
    currentLevel.push(node);
  }
  return node;
}

/**
 * Append a path part to the current accumulated path
 * @param {string} currentPath - Current accumulated path
 * @param {string} part - Path segment to append
 * @returns {string} Updated path
 */
function appendPathPart(currentPath, part) {
  return currentPath ? `${currentPath}/${part}` : part;
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
    currentPath = appendPathPart(currentPath, part);
    const fullPath = `${basePath}/${currentPath}`;
    const isDir = isDirectory(fullPath, paths);
    const node = findOrCreateNode(currentLevel, part, fullPath, isDir);
    if (node.children) currentLevel = node.children;
  }
}

/**
 * Convert full path to relative path from basePath
 * @param {string} fullPath - Absolute file path
 * @param {string} basePath - Base path prefix
 * @returns {string} Relative path
 */
function toRelativePath(fullPath, basePath) {
  if (!fullPath.startsWith(basePath)) return fullPath;
  return fullPath.substring(basePath.length).replace(/^\//, '') || '.';
}

/**
 * Check if a path string is empty or blank
 * @param {string} path - Path to check
 * @returns {boolean} True if path is empty/blank
 */
function isBlankPath(path) {
  return !path || path.trim() === '';
}

/**
 * Resolve and validate a full path into tree parts
 * @param {string} fullPath - Absolute file path
 * @param {string} basePath - Base path prefix
 * @returns {string[]|null} Validated parts or null
 */
function resolveTreeParts(fullPath, basePath) {
  return validateRelativePath(toRelativePath(fullPath, basePath));
}

/**
 * Try to insert a single path into the tree
 * @param {Array} tree - Root tree array
 * @param {string} basePath - Base path prefix
 * @param {Set<string>} pathSet - All paths set
 * @param {string} fullPath - Path to insert
 */
function tryInsertPath(tree, basePath, pathSet, fullPath) {
  if (isBlankPath(fullPath)) return;
  const parts = resolveTreeParts(fullPath, basePath);
  if (!parts) return;
  insertPathIntoTree(tree, parts, basePath, pathSet);
}

/**
 * Builds file tree structure from list of paths
 * @param {Array<string>} paths - Array of file paths
 * @param {string} basePath - Base path for the tree
 * @returns {Array} File tree structure
 */
export function buildFileTree(paths, basePath) {
  const tree = [];
  const pathSet = new Set(paths);
  paths.forEach(fullPath => tryInsertPath(tree, basePath, pathSet, fullPath));
  return tree;
}
