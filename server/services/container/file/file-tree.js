/**
 * 文件树遍历模块
 *
 * 提供容器内文件树遍历功能。
 */

import containerManager from '../core/index.js';
import { MAX_TREE_DEPTH } from './constants.js';
import { validatePath, buildContainerPath } from './path-utils.js';

/**
 * 从容器内获取文件树
 * @param {number} userId - 用户 ID
 * @param {string} dirPath - 目录路径（相对于项目根目录）
 * @param {object} options - 选项
 * @returns {Promise<Array>} 文件树结构
 */
export async function getFileTreeInContainer(userId, dirPath = '.', options = {}) {
  const {
    maxDepth = MAX_TREE_DEPTH,
    currentDepth = 0,
    showHidden = false,
    projectPath = '',
    isContainerProject = false
  } = options;

  console.log('[FileTree] getFileTreeInContainer - userId:', userId, 'dirPath:', dirPath, 'projectPath:', projectPath, 'isContainerProject:', isContainerProject);

  // 验证路径
  const { safePath, error } = validatePath(dirPath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    await containerManager.getOrCreateContainer(userId);

    const containerPath = buildContainerPath(safePath, { projectPath, isContainerProject });

    // 使用 find 命令获取文件列表
    const hiddenFlag = showHidden ? '' : '-not -path "*/.*"';

    const { stream } = await containerManager.execInContainer(
      userId,
      `cd "${containerPath}" && find . -maxdepth 1 ${hiddenFlag} -printf "%P|%y|%s|%T@\\n"`
    );

    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        reject(new Error(`Failed to get file tree: ${err.message}`));
      });

      stream.on('end', () => {
        try {
          const items = [];
          const lines = output.trim().split('\n');

          for (const line of lines) {
            if (!line) continue;

            const parts = line.split('|');
            if (parts.length < 4) {
              console.warn('[FileTree] Skipping malformed line:', JSON.stringify(line));
              continue;
            }

            const [name, type, size, mtime] = parts;

            // 跳过繁重的构建目录
            if (name === 'node_modules' || name === 'dist' || name === 'build') {
              continue;
            }

            // 解析和验证值
            const parsedSize = parseInt(size, 10);
            const parsedMtime = parseFloat(mtime);

            if (isNaN(parsedSize) || isNaN(parsedMtime)) {
              console.warn('[FileTree] Skipping line with invalid values:', JSON.stringify(line));
              continue;
            }

            const dateObj = new Date(parsedMtime * 1000);
            if (isNaN(dateObj.getTime())) {
              console.warn('[FileTree] Skipping line with invalid date:', JSON.stringify(line));
              continue;
            }

            const item = {
              name,
              path: `${containerPath}/${name}`,
              type: type === 'd' ? 'directory' : 'file',
              size: parsedSize,
              modified: dateObj.toISOString()
            };

            items.push(item);
          }

          // 排序：目录优先，然后按字母顺序
          items.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

          resolve(items);
        } catch (parseError) {
          reject(new Error(`Failed to parse file tree: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to get file tree in container: ${error.message}`);
  }
}
