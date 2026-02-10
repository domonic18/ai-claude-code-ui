/**
 * FileWriter.js
 *
 * 文件写入操作类
 * 在 Docker 容器中执行文件写入操作
 *
 * @module files/adapters/operations/FileWriter
 */

import containerManager from '../../../container/core/index.js';
import { CONTAINER } from '../../../../config/config.js';

/** Default operation timeout in milliseconds */
const OPERATION_TIMEOUT_MS = 5000;

/** Write response timeout in milliseconds */
const WRITE_TIMEOUT_MS = 10000;

/**
 * 文件写入器类
 */
export class FileWriter {
  /**
   * 构造函数
   * @param {Object} adapter - 文件适配器实例
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * 写入文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async write(filePath, content, options = {}) {
    const { userId, encoding = 'utf8' } = options;

    // 使用统一的路径解析方法
    const containerPath = this.adapter._resolveContainerPath(filePath, options);

    // 验证文件大小
    const sizeValidation = this.adapter._validateFileSize(content);
    if (!sizeValidation.valid) {
      throw new Error(sizeValidation.error);
    }

    // 获取或创建容器
    await containerManager.getOrCreateContainer(userId);

    // 确保目录存在
    await this._ensureDirectory(containerPath, userId);

    // 删除旧文件（如果存在）
    await this._removeExistingFile(containerPath, userId);

    // 使用 base64 安全处理特殊字符
    const base64Content = Buffer.from(content, encoding).toString('base64');
    const writeCommand = `echo '${base64Content}' | base64 -d > "${containerPath}"`;

    const { stream } = await containerManager.execInContainer(userId, writeCommand);

    return this._handleWriteResponse(stream, containerPath);
  }

  /**
   * 确保文件所在目录存在
   * @private
   * @param {string} filePath - 文件完整路径
   * @param {string} userId - 用户 ID
   */
  async _ensureDirectory(filePath, userId) {
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    const projectsBasePath = CONTAINER.paths.projects;
    const workspacePath = CONTAINER.paths.workspace;

    if (!dirPath || dirPath === workspacePath || dirPath === projectsBasePath) {
      return;
    }

    const { stream: mkdirStream } = await containerManager.execInContainer(
      userId,
      `mkdir -p "${dirPath}"`
    );

    await new Promise((resolve, reject) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, OPERATION_TIMEOUT_MS);

      mkdirStream.on('data', () => {});
      mkdirStream.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      });
      mkdirStream.on('end', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve();
        }
      });
    });
  }

  /**
   * 删除已存在的文件
   * @private
   * @param {string} filePath - 文件路径
   * @param {string} userId - 用户 ID
   */
  async _removeExistingFile(filePath, userId) {
    const { stream: rmStream } = await containerManager.execInContainer(
      userId,
      `rm -f "${filePath}"`
    );

    await new Promise((resolve) => {
      let resolved = false;
      rmStream.on('data', () => {});
      rmStream.on('error', () => { if (!resolved) { resolved = true; resolve(); }});
      rmStream.on('end', () => { if (!resolved) { resolved = true; resolve(); }});
      setTimeout(() => { if (!resolved) { resolved = true; resolve(); }}, 5000);
    });
  }

  /**
   * 处理写入响应
   * @private
   * @param {Object} stream - 命令输出流
   * @param {string} containerPath - 容器路径
   * @returns {Promise<{success: boolean, path: string}>}
   */
  _handleWriteResponse(stream, containerPath) {
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
        const output = chunk.toString().toLowerCase();
        if (output.includes('error') ||
            output.includes('cannot') ||
            output.includes('permission denied') ||
            output.includes('no such file') ||
            output.includes('not found')) {
          errorOutput = chunk.toString();
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
      }, WRITE_TIMEOUT_MS);
    });
  }
}

export default FileWriter;
