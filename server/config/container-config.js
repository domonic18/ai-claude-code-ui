/**
 * 容器模式配置
 *
 * 重新导出统一配置模块的内容，保持向后兼容。
 *
 * @module config/container-config
 * @deprecated 请直接从 config/config 导入配置
 */

export {
  isContainerModeEnabled,
  CONTAINER,
} from './config.js';

/**
 * 根据容器模式获取文件操作实现
 * @param {number} userId - 用于容器操作的用户 ID
 * @returns {object} - 文件操作模块
 */
export async function getFileOperations(userId) {
  if (isContainerModeEnabled()) {
    // 使用容器化文件操作
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
    // 使用主机文件系统
    const { promises: fs } = await import('fs');
    const path = await import('path');

    return {
      readFile: async (filePath, options) => {
        const fullPath = options.projectPath
          ? path.join(options.projectPath, filePath)
          : filePath;
        const content = await fs.readFile(fullPath, 'utf8');
        return { content, path: fullPath };
      },

      writeFile: async (filePath, content, options) => {
        const fullPath = options.projectPath
          ? path.join(options.projectPath, filePath)
          : filePath;
        await fs.writeFile(fullPath, content, 'utf8');
        return { success: true, path: fullPath };
      },

      getFileTree: async (dirPath, options = {}) => {
        const { maxDepth = 3, currentDepth = 0, showHidden = false } = options;
        const items = [];

        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            // 如果未请求，跳过隐藏文件
            if (!showHidden && entry.name.startsWith('.')) {
              continue;
            }

            // 跳过繁重的构建目录
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

          // 排序：目录优先，然后按字母顺序
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
        // 主机系统的基本验证
        if (!filePath || typeof filePath !== 'string') {
          return { safePath: '', error: 'Invalid file path' };
        }
        return { safePath: filePath, error: null };
      },

      isContainer: false
    };
  }
}
