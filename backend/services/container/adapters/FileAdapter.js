/**
 * FileAdapter.js
 *
 * Container file adapter
 * Adapts container file operations to unified file operation interface
 *
 * @module container/adapters/FileAdapter
 */

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

  /**
   * Reads command output stream
   * @private
   * @param {Object} stream - Command output stream
   * @returns {Promise<string>}
   */
  async _readCommandOutput(stream) {
    return readStreamOutput(stream);
  }

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
