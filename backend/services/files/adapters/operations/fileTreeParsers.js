/**
 * File Tree Parsers
 *
 * Helper functions for parsing file tree output from find command
 *
 * @module files/adapters/operations/fileTreeParsers
 */

import {
  cleanPathParts,
  addNodeToTree
} from './fileTreeHelpers.js';

export {
  cleanPathParts,
  addNodeToTree
};

/**
 * Parse file tree output from find command
 * @param {string} output - Raw output from find command
 * @param {string} basePath - Base path for files
 * @returns {{
 *   validPaths: string[],
 *   pathTypeMap: Map<string, string>,
 *   pathSizeMap: Map<string, number>,
 *   pathMtimeMap: Map<string, number>
 * }} Parsed data
 */
export function parseFileTreeOutput(output, basePath) {
  const parts = output.split('\0');
  const pathTypeMap = new Map();
  const pathSizeMap = new Map();
  const pathMtimeMap = new Map();
  const validPaths = [];

  // Every 4 elements is a group: path, type, size, mtime
  for (let i = 0; i < parts.length - 3; i += 4) {
    const fullPath = parts[i];
    const typeFlag = parts[i + 1];
    const sizeStr = parts[i + 2];
    const mtimeStr = parts[i + 3];

    if (!fullPath || !typeFlag) continue;
    if (!fullPath.startsWith(basePath)) continue;

    // Convert find's type flag to our type
    let type = 'file';
    if (typeFlag === 'd' || typeFlag === 'l') {
      type = 'directory';
    }

    const size = parseInt(sizeStr, 10) || 0;
    const mtime = parseFloat(mtimeStr) || 0;

    pathTypeMap.set(fullPath, type);
    pathSizeMap.set(fullPath, size);
    pathMtimeMap.set(fullPath, mtime);
    validPaths.push(fullPath);
  }

  return { validPaths, pathTypeMap, pathSizeMap, pathMtimeMap };
}

/**
 * Build tree structure from parsed data
 * @param {string[]} validPaths - Valid file paths
 * @param {Map<string, string>} pathTypeMap - Path to type mapping
 * @param {Map<string, number>} pathSizeMap - Path to size mapping
 * @param {Map<string, number>} pathMtimeMap - Path to mtime mapping
 * @param {string} basePath - Base path
 * @param {Object} adapter - File adapter instance
 * @returns {Array} File tree structure
 */
export function buildTreeStructure(validPaths, pathTypeMap, pathSizeMap, pathMtimeMap, basePath, adapter) {
  const tree = [];
  const processedPaths = new Set();

  for (const fullPath of validPaths) {
    const relativePath = fullPath.replace(basePath + '/', '').replace(basePath, '');

    const parts = cleanPathParts(relativePath, adapter);
    if (!parts) continue;

    if (processedPaths.has(relativePath)) continue;
    processedPaths.add(relativePath);

    addNodeToTree(tree, parts, basePath, pathTypeMap, pathSizeMap, pathMtimeMap);
  }

  return tree;
}
