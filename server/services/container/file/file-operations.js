/**
 * 文件操作模块
 *
 * 提供容器内的文件读写、统计和删除功能。
 */

import containerManager from '../core/index.js';
import { MAX_FILE_SIZE } from './constants.js';
import { validatePath, buildContainerPath } from './path-utils.js';

/**
 * 从容器内读取文件内容
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径（相对于项目根目录）
 * @param {object} options - 选项
 * @returns {Promise<{content: string, path: string}>}
 */
export async function readFileInContainer(userId, filePath, options = {}) {
  const { encoding = 'utf8', projectPath = '', isContainerProject = false } = options;

  // 验证路径
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    await containerManager.getOrCreateContainer(userId);

    const containerPath = buildContainerPath(safePath, { projectPath, isContainerProject });

    // 执行 cat 命令读取文件
    const { stream } = await containerManager.execInContainer(
      userId,
      `cat "${containerPath}"`
    );

    return new Promise((resolve, reject) => {
      let content = '';
      let errorOutput = '';

      stream.on('data', (chunk) => {
        const output = chunk.toString();
        if (output.includes('No such file') || output.includes('cannot access')) {
          errorOutput += output;
        } else {
          content += output;
        }
      });

      stream.on('error', (err) => {
        reject(new Error(`Failed to read file: ${err.message}`));
      });

      stream.on('end', () => {
        if (errorOutput) {
          reject(new Error(`File not found: ${filePath}`));
        } else {
          const trimmedContent = content.replace(/\s+$/, '');
          resolve({ content: trimmedContent, path: containerPath });
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to read file in container: ${error.message}`);
  }
}

/**
 * 在容器内写入文件内容
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径（相对于项目根目录）
 * @param {string} content - 要写入的文件内容
 * @param {object} options - 选项
 * @returns {Promise<{success: boolean, path: string}>}
 */
export async function writeFileInContainer(userId, filePath, content, options = {}) {
  const { encoding = 'utf8', projectPath = '', isContainerProject = false } = options;

  // 验证路径
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  // 检查内容大小
  const contentSize = Buffer.byteLength(content, encoding);
  if (contentSize > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${contentSize} bytes (max ${MAX_FILE_SIZE})`);
  }

  try {
    await containerManager.getOrCreateContainer(userId);

    const containerPath = buildContainerPath(safePath, { projectPath, isContainerProject });

    // 如果目录不存在则创建
    const dirPath = containerPath.substring(0, containerPath.lastIndexOf('/'));
    const projectsBasePath = '/home/node/.claude/projects';
    if (dirPath && dirPath !== '/workspace' && dirPath !== projectsBasePath) {
      await new Promise(async (resolve, reject) => {
        const result = await containerManager.execInContainer(
          userId,
          `mkdir -p "${dirPath}"`
        );
        const mkdirStream = result.stream;
        mkdirStream.on('end', resolve);
        mkdirStream.on('error', reject);
      });
    }

    // 使用 base64 安全处理特殊字符
    const base64Content = Buffer.from(content, encoding).toString('base64');

    const { stream } = await containerManager.execInContainer(
      userId,
      `printf '%s' "$(echo '${base64Content}' | base64 -d)" > "${containerPath}"`
    );

    return new Promise((resolve, reject) => {
      let errorOutput = '';
      let resolved = false;
      let timeoutId = null;

      const doResolve = (result) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        }
      };

      const doReject = (err) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        }
      };

      stream.on('data', (chunk) => {
        const output = chunk.toString();
        if (output.toLowerCase().includes('error') ||
            output.toLowerCase().includes('cannot') ||
            output.toLowerCase().includes('permission denied')) {
          errorOutput += output;
        }
      });

      stream.on('error', (err) => {
        doReject(new Error(`Failed to write file: ${err.message}`));
      });

      stream.on('end', () => {
        if (errorOutput) {
          doReject(new Error(`Write failed: ${errorOutput}`));
        } else {
          doResolve({ success: true, path: containerPath });
        }
      });

      timeoutId = setTimeout(() => {
        doResolve({ success: true, path: containerPath });
      }, 3000);
    });
  } catch (error) {
    throw new Error(`Failed to write file in container: ${error.message}`);
  }
}

/**
 * 从容器内获取文件统计信息
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径
 * @param {object} options - 选项
 * @returns {Promise<object>} 文件统计信息
 */
export async function getFileStatsInContainer(userId, filePath, options = {}) {
  const { projectPath = '' } = options;

  // 验证路径
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    await containerManager.getOrCreateContainer(userId);

    const containerPath = buildContainerPath(safePath, { projectPath, isContainerProject: false });

    // 使用 stat 命令获取文件信息
    const { stream } = await containerManager.execInContainer(
      userId,
      `stat -c "%F|%s|%Y|%A" "${containerPath}"`
    );

    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        reject(new Error(`Failed to get file stats: ${err.message}`));
      });

      stream.on('end', () => {
        try {
          const [type, size, mtime, mode] = output.trim().split('|');

          resolve({
            type: type.includes('directory') ? 'directory' : 'file',
            size: parseInt(size, 10),
            modified: new Date(parseInt(mtime, 10) * 1000).toISOString(),
            mode
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse file stats: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to get file stats in container: ${error.message}`);
  }
}

/**
 * 从容器内删除文件
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径
 * @param {object} options - 选项
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteFileInContainer(userId, filePath, options = {}) {
  const { projectPath = '' } = options;

  // 验证路径
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    await containerManager.getOrCreateContainer(userId);

    const containerPath = buildContainerPath(safePath, { projectPath, isContainerProject: false });

    // 删除文件或目录
    const { stream } = await containerManager.execInContainer(
      userId,
      `rm -rf "${containerPath}"`
    );

    return new Promise((resolve, reject) => {
      let resolved = false;
      let timeoutId = null;

      const doResolve = (result) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        }
      };

      const doReject = (err) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        }
      };

      stream.on('error', (err) => {
        doReject(new Error(`Failed to delete file: ${err.message}`));
      });

      stream.on('end', () => {
        doResolve({ success: true });
      });

      timeoutId = setTimeout(() => {
        doResolve({ success: true });
      }, 2000);
    });
  } catch (error) {
    throw new Error(`Failed to delete file in container: ${error.message}`);
  }
}
