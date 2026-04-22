/**
 * File Adapter Helpers
 *
 * Helper functions for FileAdapter including path conversion,
 * stat parsing, and file tree building
 *
 * @module services/container/adapters/fileAdapterHelpers
 */

// FileAdapter 调用此模块将用户路径转换为容器路径
import { CONTAINER } from '../../../config/config.js';
import {
  cleanFileName,
  isValidFileName,
  isHiddenFile,
  isDirectory
} from '../../files/utils/file-utils.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/container/adapters/fileAdapterHelpers');

// 文件适配器在读取文件前调用此函数将用户路径转换为容器内绝对路径
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

// 解析 stat 命令输出时调用此函数创建默认统计对象
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

// 解析 stat 输出时调用此函数从行中提取数字字段
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

// 解析 stat 输出时调用此函数从行中提取文本字段
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

// 解析 stat 输出时调用此函数提取文件大小字段
/**
 * Apply stat Size field extraction
 * @param {Object} stats - Stats object to update
 * @param {string} line - Single line from stat output
 */
function applySizeLine(stats, line) {
  const size = extractMatchedNumber(line, /Size:\s+(\d+)/);
  if (size !== null) stats.size = size;
}

// 解析 stat 输出时调用此函数提取修改时间字段
/**
 * Apply stat Modify field extraction
 * @param {Object} stats - Stats object to update
 * @param {string} line - Single line from stat output
 */
function applyModifyLine(stats, line) {
  const modified = extractMatchedText(line, /Modify:\s+(.+)/);
  if (modified !== null) stats.modified = modified;
}

// 解析 stat 输出时调用此函数将单行字段应用到统计对象
/**
 * Apply stat field extraction from a single line to stats object
 * @param {Object} stats - Stats object to update
 * @param {string} line - Single line from stat output
 */
function applyStatLine(stats, line) {
  if (line.includes('Size:')) applySizeLine(stats, line);
  if (line.includes('Modify:')) applyModifyLine(stats, line);
}

// FileAdapter.getFileStats 调用此函数解析 stat 命令输出
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

// 构建文件树时调用此函数检查路径部分是否无效
/**
 * Check if a path part is invalid (empty or bad filename)
 * @param {string} part - Path segment to check
 * @returns {boolean} True if invalid
 */
function isInvalidPart(part) {
  return part === '' || !isValidFileName(part);
}

// 构建文件树时调用此函数验证相对路径是否应跳过
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

// 构建文件树时调用此函数创建树节点
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

// 构建文件树时调用此函数查找或创建树节点
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

// 构建文件树时调用此函数将路径部分追加到当前路径
/**
 * Append a path part to the current accumulated path
 * @param {string} currentPath - Current accumulated path
 * @param {string} part - Path segment to append
 * @returns {string} Updated path
 */
function appendPathPart(currentPath, part) {
  return currentPath ? `${currentPath}/${part}` : part;
}

// 构建文件树时调用此函数将单个路径的部分插入树结构
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

// 构建文件树时调用此函数将完整路径转换为相对路径
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

// 构建文件树时调用此函数检查路径是否为空
/**
 * Check if a path string is empty or blank
 * @param {string} path - Path to check
 * @returns {boolean} True if path is empty/blank
 */
function isBlankPath(path) {
  return !path || path.trim() === '';
}

// 构建文件树时调用此函数解析和验证完整路径
/**
 * Resolve and validate a full path into tree parts
 * @param {string} fullPath - Absolute file path
 * @param {string} basePath - Base path prefix
 * @returns {string[]|null} Validated parts or null
 */
function resolveTreeParts(fullPath, basePath) {
  return validateRelativePath(toRelativePath(fullPath, basePath));
}

// 构建文件树时调用此函数尝试将单个路径插入树
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

// FileAdapter.getFileTree 调用此函数从路径列表构建文件树结构
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
