/**
 * FileRenamer.js
 *
 * 文件重命名操作类
 * 在 Docker 容器中执行文件/目录重命名操作
 *
 * @module files/adapters/operations/FileRenamer
 */

import containerManager from '../../../container/core/index.js';

/** Operation timeout in milliseconds */
const OPERATION_TIMEOUT_MS = 5000;

/**
 * 文件重命名器类
 */
export class FileRenamer {
  /**
   * 构造函数
   * @param {Object} adapter - 文件适配器实例
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * 重命名文件或目录
   * @param {string} oldPath - 旧路径
   * @param {string} newName - 新名称
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, newPath: string}>}
   */
  async rename(oldPath, newName, options = {}) {
    const { userId } = options;

    // 验证新名称
    if (!newName || newName.trim() === '') {
      throw new Error('New name cannot be empty');
    }

    const cleanName = this.adapter._cleanFileName(newName.trim());
    if (!this.adapter._isValidFileName(cleanName)) {
      throw new Error('Invalid file name');
    }

    // 获取或创建容器
    await containerManager.getOrCreateContainer(userId);

    // 解析旧路径
    const oldContainerPath = this.adapter._resolveContainerPath(oldPath, options);

    // 构建新路径
    const pathParts = oldContainerPath.split('/');
    pathParts[pathParts.length - 1] = cleanName;
    const newContainerPath = pathParts.join('/');

    // 使用 mv 命令重命名
    const renameCommand = `mv "${oldContainerPath}" "${newContainerPath}" 2>&1`;
    const { stream } = await containerManager.execInContainer(userId, renameCommand);

    return this._handleRenameResponse(stream, newContainerPath);
  }

  /**
   * 处理重命名响应
   * @private
   * @param {Object} stream - 命令输出流
   * @param {string} newPath - 新路径
   * @returns {Promise<{success: boolean, newPath: string}>}
   */
  _handleRenameResponse(stream, newPath) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      let output = '';

      const doResolve = (result) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      const doReject = (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      };

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        doReject(new Error(`Failed to rename: ${err.message}`));
      });

      stream.on('end', () => {
        if (output.trim() && output.toLowerCase().includes('cannot')) {
          doReject(new Error(`Rename failed: ${output}`));
          return;
        }
        doResolve({ success: true, newPath });
      });

      setTimeout(() => {
        doResolve({ success: true, newPath });
      }, OPERATION_TIMEOUT_MS);
    });
  }
}

export default FileRenamer;
