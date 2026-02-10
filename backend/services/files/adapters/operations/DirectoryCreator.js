/**
 * DirectoryCreator.js
 *
 * 目录创建操作类
 * 在 Docker 容器中执行目录创建操作
 *
 * @module files/adapters/operations/DirectoryCreator
 */

import containerManager from '../../../container/core/index.js';

/** Operation timeout in milliseconds */
const OPERATION_TIMEOUT_MS = 5000;

/**
 * 目录创建器类
 */
export class DirectoryCreator {
  /**
   * 构造函数
   * @param {Object} adapter - 文件适配器实例
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async create(dirPath, options = {}) {
    const { userId, recursive = true } = options;

    // 验证路径
    const validation = this.adapter._validatePath(dirPath, options);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 获取或创建容器
    await containerManager.getOrCreateContainer(userId);

    // 构建容器路径
    const containerPath = this.adapter._buildContainerPath(
      validation.safePath,
      options
    );

    // 执行创建命令
    const recursiveFlag = recursive ? '-p' : '';
    const command = `mkdir ${recursiveFlag} "${containerPath}"`;

    await this._executeCreate(userId, command);

    return {
      success: true,
      path: containerPath
    };
  }

  /**
   * 执行创建命令
   * @private
   */
  async _executeCreate(userId, command) {
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

      containerManager.execInContainer(userId, command)
        .then(({ stream }) => {
          stream.on('error', (err) => {
            doReject(new Error(`Failed to create directory: ${err.message}`));
          });

          stream.on('end', () => {
            doResolve({ success: true });
          });
        })
        .catch((err) => {
          doReject(new Error(`Failed to execute mkdir command: ${err.message}`));
        });

      // 5秒超时保护
      timeoutId = setTimeout(() => {
        doResolve({ success: true });
      }, OPERATION_TIMEOUT_MS);
    });
  }
}

export default DirectoryCreator;
