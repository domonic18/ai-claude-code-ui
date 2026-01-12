/**
 * BaseFileAdapter.js
 *
 * 文件操作适配器基类
 * 定义所有文件操作适配器的统一接口
 *
 * @module files/adapters/BaseFileAdapter
 */

import { IFileOperations } from '../../core/interfaces/IFileOperations.js';

/**
 * 抽象文件适配器基类
 * 所有文件操作适配器都必须继承此类并实现抽象方法
 *
 * @abstract
 */
export class BaseFileAdapter extends IFileOperations {
  /**
   * 构造函数
   * @param {Object} config - 适配器配置
   * @param {string} config.name - 适配器名称
   * @param {string} config.version - 适配器版本
   */
  constructor(config = {}) {
    super();
    this.name = config.name || 'BaseAdapter';
    this.version = config.version || '1.0.0';
  }

  /**
   * 读取文件内容
   * @abstract
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   * @throws {Error} 如果子类未实现
   */
  async readFile(filePath, options = {}) {
    throw new Error(`readFile() must be implemented by ${this.name}`);
  }

  /**
   * 写入文件内容
   * @abstract
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   * @throws {Error} 如果子类未实现
   */
  async writeFile(filePath, content, options = {}) {
    throw new Error(`writeFile() must be implemented by ${this.name}`);
  }

  /**
   * 获取文件树结构
   * @abstract
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 文件树
   * @throws {Error} 如果子类未实现
   */
  async getFileTree(dirPath, options = {}) {
    throw new Error(`getFileTree() must be implemented by ${this.name}`);
  }

  /**
   * 获取文件统计信息
   * @abstract
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 文件统计信息
   * @throws {Error} 如果子类未实现
   */
  async getFileStats(filePath, options = {}) {
    throw new Error(`getFileStats() must be implemented by ${this.name}`);
  }

  /**
   * 删除文件
   * @abstract
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean}>}
   * @throws {Error} 如果子类未实现
   */
  async deleteFile(filePath, options = {}) {
    throw new Error(`deleteFile() must be implemented by ${this.name}`);
  }

  /**
   * 检查文件是否存在
   * @abstract
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>}
   * @throws {Error} 如果子类未实现
   */
  async fileExists(filePath) {
    throw new Error(`fileExists() must be implemented by ${this.name}`);
  }

  /**
   * 创建目录
   * @abstract
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   * @throws {Error} 如果子类未实现
   */
  async createDirectory(dirPath, options = {}) {
    throw new Error(`createDirectory() must be implemented by ${this.name}`);
  }

  /**
   * 获取适配器类型
   * @returns {string} 适配器类型标识
   */
  getType() {
    return this.adapterType || 'base';
  }

  /**
   * 验证路径安全性
   * @protected
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Object} { valid: boolean, error: string|null, safePath: string }
   */
  _validatePath(filePath, options = {}) {
    const { PathValidator } = options.validators || {};

    // 基本路径验证
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'File path must be a non-empty string', safePath: '' };
    }

    // 检查路径遍历
    if (filePath.includes('..')) {
      return { valid: false, error: 'Path traversal detected', safePath: '' };
    }

    return { valid: true, error: null, safePath: filePath };
  }

  /**
   * 标准化文件路径
   * @protected
   * @param {string} filePath - 文件路径
   * @returns {string} 标准化后的路径
   */
  _normalizePath(filePath) {
    // 移除开头的斜杠（如果有）
    let normalized = filePath.replace(/^\/+/, '');
    // 移除结尾的斜杠
    normalized = normalized.replace(/\/+$/, '');
    return normalized;
  }

  /**
   * 构建完整路径
   * @protected
   * @param {string} basePath - 基础路径
   * @param {string} relativePath - 相对路径
   * @returns {string} 完整路径
   */
  _buildFullPath(basePath, relativePath) {
    const path = this._normalizePath(relativePath);
    return `${basePath}/${path}`.replace(/\/+/g, '/');
  }

  /**
   * 验证文件大小
   * @protected
   * @param {string} content - 文件内容
   * @param {number} maxSize - 最大大小
   * @returns {Object} { valid: boolean, error: string|null }
   */
  _validateFileSize(content, maxSize) {
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > maxSize) {
      return {
        valid: false,
        error: `File too large: ${contentSize} bytes (max ${maxSize})`
      };
    }
    return { valid: true, error: null };
  }

  /**
   * 标准化错误消息
   * @protected
   * @param {Error} error - 原始错误
   * @param {string} operation - 操作名称
   * @returns {Object} 标准化错误对象
   */
  _standardizeError(error, operation) {
    return {
      type: 'file_operation_error',
      operation,
      message: error.message || 'Unknown error occurred',
      adapter: this.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取适配器信息
   * @returns {Object} 适配器信息
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      type: this.getType()
    };
  }
}

export default BaseFileAdapter;
