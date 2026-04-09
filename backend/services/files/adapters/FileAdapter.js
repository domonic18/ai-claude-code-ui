/**
 * FileAdapter.js
 *
 * 文件操作适配器
 * 在 Docker 容器中执行文件操作
 *
 * @module files/adapters/FileAdapter
 */

import { BaseFileAdapter } from './BaseFileAdapter.js';
import {
  FileReader,
  FileWriter,
  FileTreeBuilder,
  FileRenamer,
  FileMover,
  DirectoryCreator
} from './operations/index.js';
import containerManager from '../../container/core/index.js';
import { PassThrough } from 'stream';

/** Operation timeout in milliseconds */
const OPERATION_TIMEOUT_MS = 5000;

/** Check file exists timeout in milliseconds */
const CHECK_EXISTS_TIMEOUT_MS = 2000;

/**
 * 文件操作适配器
 * 在用户专属的 Docker 容器中执行文件操作
 */
export class FileAdapter extends BaseFileAdapter {
  /**
   * 构造函数
   * @param {Object} config - 适配器配置
   */
  constructor(config = {}) {
    super({
      name: 'FileAdapter',
      version: '2.0.0',
      ...config
    });
    this.adapterType = 'container';

    // 初始化操作类
    this.reader = new FileReader(this);
    this.writer = new FileWriter(this);
    this.treeBuilder = new FileTreeBuilder(this);
    this.renamer = new FileRenamer(this);
    this.mover = new FileMover(this);
    this.directoryCreator = new DirectoryCreator(this);
  }

  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   */
  async readFile(filePath, options = {}) {
    try {
      return await this.reader.read(filePath, options);
    } catch (error) {
      throw this._standardizeError(error, 'readFile');
    }
  }

  /**
   * 写入文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeFile(filePath, content, options = {}) {
    try {
      return await this.writer.write(filePath, content, options);
    } catch (error) {
      throw this._standardizeError(error, 'writeFile');
    }
  }

  /**
   * 获取文件树结构
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 文件树
   */
  async getFileTree(dirPath, options = {}) {
    try {
      return await this.treeBuilder.build(dirPath, options);
    } catch (error) {
      throw this._standardizeError(error, 'getFileTree');
    }
  }

  /**
   * 获取文件统计信息
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 文件统计信息
   */
  async getFileStats(filePath, options = {}) {
    const { userId } = options;

    try {
      const containerPath = this._resolveContainerPath(filePath, options);
      await containerManager.getOrCreateContainer(userId);

      const { stream } = await containerManager.execInContainer(
        userId,
        `stat -c "%F|%s|%Y|%A" "${containerPath}"`
      );

      return this._parseFileStats(stream, containerPath);
    } catch (error) {
      throw this._standardizeError(error, 'getFileStats');
    }
  }

  /**
   * 解析文件统计信息
   * @private
   * @param {Object} stream - 命令输出流
   * @param {string} containerPath - 容器路径
   * @returns {Promise<{type: string, size: number, modified: string, mode: string}>} 文件统计信息
   */
  _parseFileStats(stream, containerPath) {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    containerManager.docker.modem.demuxStream(stream, stdout, stderr);

    return new Promise((resolve, reject) => {
      let output = '';

      stdout.on('data', (chunk) => {
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
  }

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filePath, options = {}) {
    const { userId } = options;

    try {
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      await containerManager.getOrCreateContainer(userId);
      const containerPath = validation.safePath;

      const { stream } = await containerManager.execInContainer(
        userId,
        `rm -rf "${containerPath}"`
      );

      return this._handleDeleteResponse(stream, containerPath, userId);
    } catch (error) {
      throw this._standardizeError(error, 'deleteFile');
    }
  }

  /**
   * 处理删除响应
   * @private
   * @param {Object} stream - 命令输出流
   * @param {string} containerPath - 容器路径
   * @param {string} userId - 用户 ID
   * @returns {Promise<{success: boolean}>} 删除结果
   */
  async _handleDeleteResponse(stream, containerPath, userId) {
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

      stream.on('data', () => {});
      stream.on('error', (err) => {
        doReject(new Error(`Failed to delete file: ${err.message}`));
      });

      stream.on('end', async () => {
        try {
          const checkCommand = `test -e "${containerPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
          const { stream: checkStream } = await containerManager.execInContainer(userId, checkCommand);

          let checkOutput = '';
          checkStream.on('data', (chunk) => {
            checkOutput += chunk.toString();
          });

          checkStream.on('end', () => {
            if (checkOutput.trim() === 'EXISTS') {
              doReject(new Error(`File still exists after deletion`));
            } else {
              doResolve({ success: true });
            }
          });
        } catch {
          doResolve({ success: true });
        }
      });

      timeoutId = setTimeout(() => {
        doResolve({ success: true });
      }, OPERATION_TIMEOUT_MS);
    });
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath, options = {}) {
    const { userId } = options;

    try {
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        return false;
      }

      await containerManager.getOrCreateContainer(userId);
      const containerPath = validation.safePath;

      const { stream } = await containerManager.execInContainer(
        userId,
        `test -e "${containerPath}" && echo "EXISTS" || echo "NOT_EXISTS"`
      );

      return new Promise((resolve) => {
        let output = '';
        let resolved = false;

        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('error', () => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        });

        stream.on('end', () => {
          if (!resolved) {
            resolved = true;
            resolve(output.trim() === 'EXISTS');
          }
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }, CHECK_EXISTS_TIMEOUT_MS);
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * 重命名文件或目录
   * @param {string} oldPath - 旧路径
   * @param {string} newName - 新名称
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, newPath: string}>}
   */
  async renameFile(oldPath, newName, options = {}) {
    try {
      return await this.renamer.rename(oldPath, newName, options);
    } catch (error) {
      throw this._standardizeError(error, 'renameFile');
    }
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createDirectory(dirPath, options = {}) {
    try {
      return await this.directoryCreator.create(dirPath, options);
    } catch (error) {
      throw this._standardizeError(error, 'createDirectory');
    }
  }

  /**
   * 移动文件或目录
   * @param {string} sourcePath - 源路径
   * @param {string} targetDir - 目标目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, newPath: string}>}
   */
  async moveFile(sourcePath, targetDir, options = {}) {
    try {
      return await this.mover.move(sourcePath, targetDir, options);
    } catch (error) {
      throw this._standardizeError(error, 'moveFile');
    }
  }
}

export default FileAdapter;
