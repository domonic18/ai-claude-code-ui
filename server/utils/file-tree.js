/**
 * File Tree Utilities
 *
 * Provides functions for generating file tree structures
 * from directory paths with support for filtering and metadata.
 */

import { promises as fsPromises } from 'fs';
import path from 'path';

/**
 * Convert permission bits to rwx format
 * @param {number} perm - Permission bits (0-7)
 * @returns {string} rwx format string (e.g., 'rwx', 'r-x', '---')
 */
function permToRwx(perm) {
  const r = (perm & 4) ? 'r' : '-';
  const w = (perm & 2) ? 'w' : '-';
  const x = (perm & 1) ? 'x' : '-';
  return r + w + x;
}

/**
 * Get file tree structure for a directory
 * @param {string} dirPath - Directory path to scan
 * @param {number} maxDepth - Maximum depth to traverse (default: 3)
 * @param {number} currentDepth - Current depth level (default: 0)
 * @param {boolean} showHidden - Include hidden files (default: true)
 * @returns {Promise<Array>} Array of file/directory objects
 */
export async function getFileTree(dirPath, maxDepth = 3, currentDepth = 0, showHidden = true) {
  const items = [];

  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip only heavy build directories
      if (entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build') continue;

      const itemPath = path.join(dirPath, entry.name);
      const item = {
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'directory' : 'file'
      };

      // Get file stats for additional metadata
      try {
        const stats = await fsPromises.stat(itemPath);
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();

        // Convert permissions to rwx format
        const mode = stats.mode;
        const ownerPerm = (mode >> 6) & 7;
        const groupPerm = (mode >> 3) & 7;
        const otherPerm = mode & 7;
        item.permissions = ((mode >> 6) & 7).toString() + ((mode >> 3) & 7).toString() + (mode & 7).toString();
        item.permissionsRwx = permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm);
      } catch (statError) {
        // If stat fails, provide default values
        item.size = 0;
        item.modified = null;
        item.permissions = '000';
        item.permissionsRwx = '---------';
      }

      if (entry.isDirectory() && currentDepth < maxDepth) {
        // Recursively get subdirectories but limit depth
        try {
          // Check if we can access the directory before trying to read it
          await fsPromises.access(item.path, fsPromises.constants.R_OK);
          item.children = await getFileTree(item.path, maxDepth, currentDepth + 1, showHidden);
        } catch (e) {
          // Silently skip directories we can't access (permission denied, etc.)
          item.children = [];
        }
      }

      items.push(item);
    }
  } catch (error) {
    // Only log non-permission errors to avoid spam
    if (error.code !== 'EACCES' && error.code !== 'EPERM') {
      console.error('Error reading directory:', error);
    }
  }

  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
