/**
 * FileAdapter.js
 *
 * Container file adapter
 * Adapts container file operations to unified file operation interface
 *
 * @module container/adapters/FileAdapter
 */

// 执行引擎和会话管理器调用此适配器在容器内执行文件操作
import containerManager from '../core/index.js';
import { PathValidator } from '../../core/utils/path-utils.js';
import { createLogger } from '../../../utils/logger.js';
import {
  readStreamOutput,
  standardizeError
} from '../../files/utils/file-utils.js';
import { writeFileViaShell } from '../utils/containerFileWriter.js';
import { toContainerPath, parseStatOutput, buildFileTree } from './fileAdapterHelpers.js';

const logger = createLogger('services/container/adapters/FileAdapter');

// 容器文件适配器，将容器文件操作适配到 IFileOperations 接口
/**
 * Container file adapter
 * Adapts container file operations to IFileOperations interface
 */
export class FileAdapter {
  /**
   * Constructor
   * @param {Object} config - Configuration
   * @param {number} config.userId - User ID
   */
  constructor(config = {}) {
    this.userId = config.userId;
    this.containerManager = config.containerManager || containerManager;
    this.pathValidator = new PathValidator();
  }

  // 执行引擎调用此函数从容器内读取文件内容
  /**
   * Reads file
   * @param {string} filePath - File path
   * @param {Object} options - Options
   * @param {boolean} options.base64 - Use base64 encoding
   * @returns {Promise<{content: string, path: string}>}
   */
  async readFile(filePath, options = {}) {
    const { base64 = false } = options;

    try {
      const validation = this.pathValidator.validateContainerPath(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = toContainerPath(filePath);

      if (base64) {
        const command = `base64 "${containerPath}"`;
        const { stream } = await this.containerManager.execInContainer(this.userId, command);
        const content = await this._readCommandOutput(stream);

        return {
          content: content.trim(),
          path: filePath,
          encoding: 'base64'
        };
      }

      const { stream } = await this.containerManager.execInContainer(this.userId, `cat "${containerPath}"`);
      const content = await this._readCommandOutput(stream);

      return {
        content,
        path: filePath,
        encoding: 'utf8'
      };

    } catch (error) {
      throw this._standardizeError(error, 'readFile');
    }
  }

  // 执行引擎调用此函数将内容写入容器内文件
  /**
   * Writes file
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @param {Object} options - Options
   * @param {boolean} options.base64 - Content is base64 encoded
   * @param {boolean} options.createDirectory - Auto-create directory
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeFile(filePath, content, options = {}) {
    const { base64 = false, createDirectory = true } = options;

    try {
      const validation = this.pathValidator.validateContainerPath(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = toContainerPath(filePath);

      if (createDirectory) {
        const dirPath = containerPath.substring(0, containerPath.lastIndexOf('/'));
        if (dirPath) {
          await this.containerManager.execInContainer(this.userId, `mkdir -p "${dirPath}"`);
        }
      }

      const textContent = base64
        ? Buffer.from(content, 'base64').toString('utf8')
        : content;

      await writeFileViaShell(this.containerManager, this.userId, containerPath, textContent);

      return {
        success: true,
        path: filePath
      };

    } catch (error) {
      throw this._standardizeError(error, 'writeFile');
    }
  }

  // 会话管理器调用此函数获取容器内目录的文件树结构
  /**
   * Gets file tree
   * @param {string} dirPath - Directory path
   * @param {Object} options - Options
   * @param {number} options.depth - Max depth
   * @param {boolean} options.includeHidden - Include hidden files
   * @returns {Promise<Array>}
   */
  async getFileTree(dirPath, options = {}) {
    const { depth = 10, includeHidden = false } = options;

    try {
      const validation = this.pathValidator.validateContainerPath(dirPath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = toContainerPath(dirPath);

      const findCommand = includeHidden
        ? `find "${containerPath}" -maxdepth ${depth}`
        : `find "${containerPath}" -maxdepth ${depth} -not -path "*/\\.*"`;

      const { stream } = await this.containerManager.execInContainer(this.userId, findCommand);
      const output = await this._readCommandOutput(stream);

      const lines = output.trim().split('\n').filter(Boolean);
      const fileTree = buildFileTree(lines, containerPath);

      return fileTree;

    } catch (error) {
      throw this._standardizeError(error, 'getFileTree');
    }
  }

  // 文件浏览器调用此函数获取容器内文件的统计信息
  /**
   * Gets file stats
   * @param {string} filePath - File path
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  async getFileStats(filePath, options = {}) {
    try {
      const validation = this.pathValidator.validateContainerPath(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = toContainerPath(filePath);

      const { stream } = await this.containerManager.execInContainer(
        this.userId,
        `stat "${containerPath}"`
      );
      const output = await this._readCommandOutput(stream);

      return parseStatOutput(output, filePath);

    } catch (error) {
      throw this._standardizeError(error, 'getFileStats');
    }
  }

  // 文件浏览器调用此函数删除容器内文件
  /**
   * Deletes file
   * @param {string} filePath - File path
   * @param {Object} options - Options
   * @param {boolean} options.recursive - Recursive delete
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filePath, options = {}) {
    const { recursive = false } = options;

    try {
      const validation = this.pathValidator.validateContainerPath(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = toContainerPath(filePath);

      const command = recursive
        ? `rm -rf "${containerPath}"`
        : `rm -f "${containerPath}"`;

      await this.containerManager.execInContainer(this.userId, command);

      return { success: true };

    } catch (error) {
      throw this._standardizeError(error, 'deleteFile');
    }
  }

  // 执行引擎调用此函数检查容器内文件是否存在
  /**
   * Checks if file exists
   * @param {string} filePath - File path
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await this.getFileStats(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 文件浏览器调用此函数在容器内创建目录
  /**
   * Creates directory
   * @param {string} dirPath - Directory path
   * @param {Object} options - Options
   * @param {boolean} options.recursive - Recursive create
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createDirectory(dirPath, options = {}) {
    const { recursive = true } = options;

    try {
      const validation = this.pathValidator.validateContainerPath(dirPath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = toContainerPath(dirPath);

      const command = recursive
        ? `mkdir -p "${containerPath}"`
        : `mkdir "${containerPath}"`;

      await this.containerManager.execInContainer(this.userId, command);

      return {
        success: true,
        path: dirPath
      };

    } catch (error) {
      throw this._standardizeError(error, 'createDirectory');
    }
  }

  // 内部方法：从 Docker exec 流读取命令输出
  /**
   * Reads command output stream
   * @private
   * @param {Object} stream - Command output stream
   * @returns {Promise<string>}
   */
  async _readCommandOutput(stream) {
    return readStreamOutput(stream);
  }

  // 内部方法：标准化错误对象以便统一处理
  /**
   * Standardizes error
   * @private
   * @param {Error} error - Original error
   * @param {string} operation - Operation name
   * @returns {Error} Standardized error
   */
  _standardizeError(error, operation) {
    return standardizeError(error, operation, {
      userId: this.userId,
      type: 'container_file_error'
    });
  }
}

export default FileAdapter;
