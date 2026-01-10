/**
 * Container Mode Configuration
 *
 * Controls whether file operations are performed through Docker containers
 * or directly on the host system.
 */

/**
 * Check if container mode is enabled via environment variable
 * @returns {boolean} - True if container mode is enabled
 */
export function isContainerModeEnabled() {
  return process.env.CONTAINER_MODE === 'true' || process.env.CONTAINER_MODE === '1';
}

/**
 * Log container mode status (call this after .env is loaded)
 */
export function logContainerModeStatus() {
  if (isContainerModeEnabled()) {
    console.log('[CONFIG] Container mode: ENABLED');
    console.log('[CONFIG] File operations will be performed through Docker containers');
  } else {
    console.log('[CONFIG] Container mode: DISABLED (default)');
    console.log('[CONFIG] File operations will be performed on host system');
    console.log('[CONFIG] To enable container mode, set CONTAINER_MODE=1');
  }
}

/**
 * Get the file operations implementation based on container mode
 * @param {number} userId - User ID for container operations
 * @returns {object} - File operations module
 */
export async function getFileOperations(userId) {
  if (isContainerModeEnabled()) {
    // Use containerized file operations
    const {
      readFileInContainer,
      writeFileInContainer,
      getFileTreeInContainer,
      getFileStatsInContainer,
      deleteFileInContainer,
      validatePath
    } = await import('../services/container/index.js');

    return {
      readFile: (filePath, options) => readFileInContainer(userId, filePath, options),
      writeFile: (filePath, content, options) => writeFileInContainer(userId, filePath, content, options),
      getFileTree: (dirPath, options) => getFileTreeInContainer(userId, dirPath, options),
      getFileStats: (filePath, options) => getFileStatsInContainer(userId, filePath, options),
      deleteFile: (filePath, options) => deleteFileInContainer(userId, filePath, options),
      validatePath: (filePath) => validatePath(filePath),
      isContainer: true
    };
  } else {
    // Use host file system
    const { promises: fs } = await import('fs');
    const path = await import('path');

    return {
      readFile: async (filePath, options) => {
        const fullPath = options.projectPath
          ? path.join(options.projectPath, filePath)
          : filePath;
        const content = await fs.readFile(fullPath, 'utf-8');
        return { content, path: fullPath };
      },

      writeFile: async (filePath, content, options) => {
        const fullPath = options.projectPath
          ? path.join(options.projectPath, filePath)
          : filePath;
        await fs.writeFile(fullPath, content, 'utf-8');
        return { success: true, path: fullPath };
      },

      getFileTree: async (dirPath, options = {}) => {
        const { maxDepth = 3, currentDepth = 0, showHidden = false } = options;
        const items = [];

        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            // Skip hidden files if not requested
            if (!showHidden && entry.name.startsWith('.')) {
              continue;
            }

            // Skip heavy build directories
            if (entry.name === 'node_modules' ||
                entry.name === 'dist' ||
                entry.name === 'build') {
              continue;
            }

            const itemPath = path.join(dirPath, entry.name);
            const stats = await fs.stat(itemPath);

            items.push({
              name: entry.name,
              path: itemPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString()
            });
          }

          // Sort: directories first, then alphabetically
          items.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

          return items;
        } catch (error) {
          throw new Error(`Failed to read directory: ${error.message}`);
        }
      },

      getFileStats: async (filePath, options = {}) => {
        const fullPath = options.projectPath
          ? path.join(options.projectPath, filePath)
          : filePath;
        const stats = await fs.stat(fullPath);

        return {
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
          mode: stats.mode.toString(8)
        };
      },

      deleteFile: async (filePath, options = {}) => {
        const fullPath = options.projectPath
          ? path.join(options.projectPath, filePath)
          : filePath;
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          await fs.unlink(fullPath);
        }

        return { success: true };
      },

      validatePath: (filePath) => {
        // Basic validation for host system
        if (!filePath || typeof filePath !== 'string') {
          return { safePath: '', error: 'Invalid file path' };
        }
        return { safePath: filePath, error: null };
      },

      isContainer: false
    };
  }
}
