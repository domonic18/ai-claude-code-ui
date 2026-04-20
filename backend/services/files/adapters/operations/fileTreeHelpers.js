/**
 * File Tree Helpers
 *
 * Helper functions for building file tree structures from parsed data
 *
 * @module files/adapters/operations/fileTreeHelpers
 */

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
 * Add node to tree structure
 * @param {Array} tree - Tree array
 * @param {string[]} parts - Path parts
 * @param {string} basePath - Base path
 * @param {Map<string, string>} pathTypeMap - Path to type mapping
 * @param {Map<string, number>} pathSizeMap - Path to size mapping
 * @param {Map<string, number>} pathMtimeMap - Path to mtime mapping
 * @returns {void}
 */
export function addNodeToTree(tree, parts, basePath, pathTypeMap, pathSizeMap, pathMtimeMap) {
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
