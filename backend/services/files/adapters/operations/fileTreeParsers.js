/**
 * File Tree Parsers
 *
 * Helper functions for parsing file tree output from find command
 *
 * @module files/adapters/operations/fileTreeParsers
 */

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
 * Clean and validate file path parts
 * @param {string} relativePath - Relative path from base
 * @param {Object} adapter - File adapter instance
 * @returns {string[] | null} Cleaned path parts or null if invalid
 */
export function cleanPathParts(relativePath, adapter) {
  // Skip hidden files
  const pathParts = relativePath.split('/');
  if (pathParts.some(part => adapter._isHiddenFile(part))) {
    return null;
  }

  const parts = relativePath.split('/').filter(Boolean).map(name => adapter._cleanFileName(name));
  if (parts.length === 0 || parts.some(part => part === '' || !adapter._isValidFileName(part))) {
    return null;
  }

  return parts;
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

/**
 * Add node to tree structure
 * @param {Array} tree - Tree array
 * @param {string[]} parts - Path parts
 * @param {string} basePath - Base path
 * @param {Map<string, string>} pathTypeMap - Path to type mapping
 * @param {Map<string, number>} pathSizeMap - Path to size mapping
 * @param {Map<string, number>} pathMtimeMap - Path to mtime mapping
 * @returns {void}
 */
function addNodeToTree(tree, parts, basePath, pathTypeMap, pathSizeMap, pathMtimeMap) {
  let currentLevel = tree;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const pathSoFar = `${basePath}/${parts.slice(0, i + 1).join('/')}`;
    const type = pathTypeMap.get(pathSoFar) || 'file';
    const size = pathSizeMap.get(pathSoFar) || 0;
    const mtime = pathMtimeMap.get(pathSoFar) || 0;

    let existing = currentLevel.find(item => item.name === part);

    if (!existing) {
      existing = {
        name: part,
        type: type,
        path: pathSoFar,
        size: type === 'file' ? size : 0,
        modified: mtime ? new Date(mtime * 1000).toISOString() : null
      };

      if (type === 'directory') {
        existing.children = [];
      }

      currentLevel.push(existing);
    } else if (type === 'directory' && !existing.children) {
      existing.type = 'directory';
      existing.children = [];
    }

    if (type === 'directory') {
      currentLevel = existing.children || tree;
    }
  }
}
