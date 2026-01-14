/**
 * 文件树遍历模块
 *
 * 提供容器内文件树遍历功能
 *
 * @module files/utils/file-tree
 */

import { PassThrough } from 'stream';
import containerManager from '../../container/core/index.js';
import { MAX_TREE_DEPTH } from '../constants.js';
import { validatePath, buildContainerPath } from './container-path-utils.js';

/**
 * 清理文件名中的控制字符和特殊字符
 * @param {string} name - 原始文件名
 * @returns {string} 清理后的文件名
 */
function cleanFileName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // 移除空字节
  let cleaned = name.replace(/\0/g, '');

  // 移除控制字符（保留常见安全字符）
  // 保留：字母、数字、中文、常用符号、点、横线、下划线、空格
  cleaned = cleaned.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');

  // 移除 ANSI 转义序列
  cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, '');
  cleaned = cleaned.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

  // 移除回车和换行
  cleaned = cleaned.replace(/[\r\n]/g, '');

  // 移除前后空白
  cleaned = cleaned.trim();

  return cleaned;
}

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
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      let output = '';

      // 使用 Docker 的 demuxStream 分离 stdout/stderr，移除 8 字节协议头
      containerManager.docker.modem.demuxStream(stream, stdout, stderr);

      stdout.on('data', (chunk) => {
        output += chunk.toString();
      });

      stderr.on('data', (chunk) => {
        console.error('[FileTree] STDERR:', chunk.toString());
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

            const [rawName, type, size, mtime] = parts;

            // 清理文件名
            const name = cleanFileName(rawName);

            // 跳过空文件名
            if (!name || name === '' || name === '.') {
              console.warn('[FileTree] Skipping empty or invalid filename:', JSON.stringify(rawName));
              continue;
            }

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
