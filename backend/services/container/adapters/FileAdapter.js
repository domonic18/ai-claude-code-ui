/**
 * FileAdapter.js
 *
 * 容器文件适配器
 * 将容器文件操作适配到统一文件操作接口
 *
 * @module container/adapters/FileAdapter
 */

import containerManager from '../core/index.js';
import { CONTAINER } from '../../../config/config.js';
import { PathValidator } from '../../core/utils/path-utils.js';

/**
 * 容器文件适配器
 * 将容器文件操作适配到 IFileOperations 接口
 */
export class FileAdapter {
  /**
   * 构造函数
   * @param {Object} config - 配置
   * @param {number} config.userId - 用户 ID
   */
  constructor(config = {}) {
    this.userId = config.userId;
    this.containerManager = config.containerManager || containerManager;
    this.pathValidator = new PathValidator();
  }

  /**
   * 读取文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @param {boolean} options.base64 - 是否使用 base64 编码
   * @returns {Promise<{content: string, path: string}>}
   */
  async readFile(filePath, options = {}) {
    const { base64 = false } = options;

    try {
      // 验证路径
      const validation = this.pathValidator.validateContainerPath(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = this._toContainerPath(filePath);

      if (base64) {
        // 使用 base64 编码读取
        const command = `base64 "${containerPath}"`;
        const { stream } = await this.containerManager.execInContainer(this.userId, command);
        const content = await this._readCommandOutput(stream);

        return {
          content: content.trim(),
          path: filePath,
          encoding: 'base64'
        };
      } else {
        // 直接读取
        const { stream } = await this.containerManager.execInContainer(this.userId, `cat "${containerPath}"`);
        const content = await this._readCommandOutput(stream);

        return {
          content,
          path: filePath,
          encoding: 'utf8'
        };
      }

    } catch (error) {
      throw this._standardizeError(error, 'readFile');
    }
  }

  /**
   * 写入文件
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @param {boolean} options.base64 - 内容是否是 base64 编码
   * @param {boolean} options.createDirectory - 是否自动创建目录
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeFile(filePath, content, options = {}) {
    const { base64 = false, createDirectory = true } = options;

    try {
      // 验证路径
      const validation = this.pathValidator.validateContainerPath(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = this._toContainerPath(filePath);

      // 确保目录存在
      if (createDirectory) {
        const dirPath = containerPath.substring(0, containerPath.lastIndexOf('/'));
        if (dirPath) {
          await this.containerManager.execInContainer(this.userId, `mkdir -p "${dirPath}"`);
        }
      }

      // 写入文件
      if (base64) {
        // 使用 base64 解码并写入
        const command = `printf '%s' "${content}" | base64 -d > "${containerPath}"`;
        await this.containerManager.execInContainer(this.userId, command);
      } else {
        // 转义特殊字符并写入
        const escapedContent = this._escapeShellContent(content);
        const command = `printf '%s' '${escapedContent}' > "${containerPath}"`;
        await this.containerManager.execInContainer(this.userId, command);
      }

      return {
        success: true,
        path: filePath
      };

    } catch (error) {
      throw this._standardizeError(error, 'writeFile');
    }
  }

  /**
   * 获取文件树
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @param {number} options.depth - 最大深度
   * @param {boolean} options.includeHidden - 是否包含隐藏文件
   * @returns {Promise<Array>}
   */
  async getFileTree(dirPath, options = {}) {
    const { depth = 10, includeHidden = false } = options;

    try {
      // 验证路径
      const validation = this.pathValidator.validateContainerPath(dirPath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = this._toContainerPath(dirPath);

      // 构建查找命令
      let findCommand = `find "${containerPath}" -maxdepth ${depth} -not -path "*/\\.*"`;
      if (includeHidden) {
        findCommand = `find "${containerPath}" -maxdepth ${depth}`;
      }

      const { stream } = await this.containerManager.execInContainer(this.userId, findCommand);
      const output = await this._readCommandOutput(stream);

      // 解析输出为文件树结构
      const lines = output.trim().split('\n').filter(Boolean);
      const fileTree = this._buildFileTree(lines, containerPath);

      return fileTree;

    } catch (error) {
      throw this._standardizeError(error, 'getFileTree');
    }
  }

  /**
   * 获取文件统计信息
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>}
   */
  async getFileStats(filePath, options = {}) {
    try {
      // 验证路径
      const validation = this.pathValidator.validateContainerPath(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = this._toContainerPath(filePath);

      const { stream } = await this.containerManager.execInContainer(
        this.userId,
        `stat "${containerPath}"`
      );
      const output = await this._readCommandOutput(stream);

      return this._parseStatOutput(output, filePath);

    } catch (error) {
      throw this._standardizeError(error, 'getFileStats');
    }
  }

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @param {boolean} options.recursive - 是否递归删除
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filePath, options = {}) {
    const { recursive = false } = options;

    try {
      // 验证路径
      const validation = this.pathValidator.validateContainerPath(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = this._toContainerPath(filePath);

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
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
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
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @param {boolean} options.recursive - 是否递归创建
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createDirectory(dirPath, options = {}) {
    const { recursive = true } = options;

    try {
      // 验证路径
      const validation = this.pathValidator.validateContainerPath(dirPath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const containerPath = this._toContainerPath(dirPath);

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
   * 转换为容器路径
   * @private
   * @param {string} filePath - 文件路径
   * @returns {string} 容器路径
   */
  _toContainerPath(filePath) {
    // 如果是绝对路径，确保它在容器内
    if (filePath.startsWith('/')) {
      return filePath;
    }

    // 相对于工作空间
    return `${CONTAINER.paths.workspace}/${filePath}`;
  }

  /**
   * 转义 Shell 内容
   * @private
   * @param {string} content - 内容
   * @returns {string} 转义后的内容
   */
  _escapeShellContent(content) {
    return content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * 读取命令输出
   * @private
   * @param {Object} stream - 命令输出流
   * @returns {Promise<string>}
   */
  async _readCommandOutput(stream) {
    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        reject(err);
      });

      stream.on('end', () => {
        resolve(output);
      });
    });
  }

  /**
   * 构建文件树结构
   * @private
   * @param {Array} paths - 文件路径数组
   * @param {string} basePath - 基础路径
   * @returns {Array} 文件树结构
   */
  _buildFileTree(paths, basePath) {
    const tree = [];

    /**
     * 清理文件名中的控制字符和非打印字符
     * @private
     * @param {string} name - 文件名
     * @returns {string} 清理后的文件名
     */
    const cleanFileName = (name) => {
      // 移除所有控制字符和非打印字符 (ASCII 0-31, 127)
      let cleaned = name.replace(/[\x00-\x1f\x7f]/g, '').trim();
      // 移除 Unicode 替换字符 U+FFFD
      cleaned = cleaned.replace(/\uFFFD/g, '').trim();
      // 移除其他非打印 Unicode 字符
      cleaned = cleaned.replace(/[\u2000-\u200F\u2028-\u202F\u205F\u3000]/g, '').trim();
      return cleaned;
    };

    /**
     * 验证文件名是否有效
     * @private
     * @param {string} name - 文件名
     * @returns {boolean} 是否有效
     */
    const isValidFileName = (name) => {
      if (!name || name.length === 0) return false;
      // 检查是否只包含有效字符（字母、数字、中文、常见符号）
      const validPattern = /^[\w\u4e00-\u9fa5\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff\u0370-\u03ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f .,_+-@#()[\]{}$%'`=~!&]+$/;
      if (!validPattern.test(name)) return false;
      // 必须包含至少一个字母或数字或中文字符（不能只有符号）
      const hasContent = /[\w\u4e00-\u9fa5\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff\u0370-\u03ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f]/.test(name);
      if (!hasContent) return false;
      // 不能包含替换字符
      return !name.includes('\ufffd');
    };

    /**
     * 检查是否为隐藏文件/目录
     * @private
     * @param {string} name - 文件名
     * @returns {boolean} 是否为隐藏文件
     */
    const isHiddenFile = (name) => {
      return name.startsWith('.');
    };

    /**
     * 判断路径是否为目录
     * @private
     * @param {string} fullPath - 完整路径
     * @returns {boolean} 是否为目录
     */
    const isDirectory = (fullPath) => {
      // 检查是否有其他路径以这个路径开头（后面跟着斜杠）
      for (const path of paths) {
        if (path !== fullPath && path.startsWith(fullPath + '/')) {
          return true;
        }
      }
      return false;
    };

    for (const fullPath of paths) {
      // 跳过空行
      if (!fullPath || fullPath.trim() === '') {
        continue;
      }

      const relativePath = fullPath.startsWith(basePath)
        ? fullPath.substring(basePath.length).replace(/^\//, '') || '.'
        : fullPath;

      // 检查路径的任何部分是否为隐藏文件
      const pathParts = relativePath.split('/');
      if (pathParts.some(part => isHiddenFile(part))) {
        continue;
      }

      const parts = relativePath.split('/').map(cleanFileName);

      // 验证每个部分是否有效
      if (parts.some(part => part === '' || !isValidFileName(part))) {
        console.log('[FileAdapter] Skipping invalid path:', relativePath, '->', parts);
        continue;
      }

      let currentLevel = tree;
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        // 构建完整路径用于判断类型
        const fullPathForCheck = `${basePath}/${currentPath}`;
        const isDir = isDirectory(fullPathForCheck);

        let existingNode = currentLevel.find(node => node.name === part);

        if (!existingNode) {
          existingNode = {
            name: part,
            path: fullPathForCheck,
            type: isDir ? 'directory' : 'file',
            children: isDir ? [] : undefined
          };
          currentLevel.push(existingNode);
        }

        if (existingNode.children) {
          currentLevel = existingNode.children;
        }
      }
    }

    return tree;
  }

  /**
   * 解析 stat 输出
   * @private
   * @param {string} output - stat 命令输出
   * @param {string} filePath - 文件路径
   * @returns {Object} 文件统计信息
   */
  _parseStatOutput(output, filePath) {
    // 简单解析，实际可能需要更复杂的逻辑
    const lines = output.split('\n');
    const stats = {
      path: filePath,
      size: 0,
      type: 'unknown',
      modified: null,
      permissions: null
    };

    for (const line of lines) {
      if (line.includes('Size:')) {
        const match = line.match(/Size:\s+(\d+)/);
        if (match) stats.size = parseInt(match[1], 10);
      }
      if (line.includes('Modify:')) {
        const match = line.match(/Modify:\s+(.+)/);
        if (match) stats.modified = match[1].trim();
      }
    }

    return stats;
  }

  /**
   * 标准化错误
   * @private
   * @param {Error} error - 原始错误
   * @param {string} operation - 操作名称
   * @returns {Error} 标准化的错误
   */
  _standardizeError(error, operation) {
    const standardizedError = new Error(
      error.message || `${operation} failed in container`
    );

    standardizedError.type = 'container_file_error';
    standardizedError.operation = operation;
    standardizedError.userId = this.userId;
    standardizedError.timestamp = new Date().toISOString();
    standardizedError.originalError = error;

    return standardizedError;
  }
}

export default FileAdapter;
