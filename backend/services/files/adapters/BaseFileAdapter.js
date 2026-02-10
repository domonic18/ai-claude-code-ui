/**
 * BaseFileAdapter.js
 *
 * 文件操作适配器基类
 * 定义所有文件操作适配器的统一接口
 *
 * @module files/adapters/BaseFileAdapter
 */

import { IFileOperations } from '../../core/interfaces/IFileOperations.js';
import {
  cleanFileName,
  isValidFileName,
  isHiddenFile,
  isDirectory,
  normalizePath,
  createTreeNode,
  readStreamOutput,
  standardizeError as standardizeErrorUtil
} from '../utils/file-utils.js';
import {
  FILE_SIZE_LIMITS,
  ERROR_TYPES,
  ERROR_MESSAGES,
  FILE_TREE_CONFIG
} from '../constants.js';
import { CONTAINER } from '../../../config/config.js';
import { PathUtils } from '../../core/utils/path-utils.js';

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
    this.maxFileSize = config.maxFileSize || FILE_SIZE_LIMITS.MAX_SIZE;
    this.excludedDirs = config.excludedDirs || FILE_TREE_CONFIG.DEFAULT_EXCLUDED_DIRS;
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
    // 基本路径验证
    if (!filePath || typeof filePath !== 'string') {
      return {
        valid: false,
        error: ERROR_MESSAGES[ERROR_TYPES.INVALID_PATH].replace('{path}', filePath || 'empty'),
        safePath: ''
      };
    }

    // 检查路径遍历攻击 - 使用更严格的验证
    // 1. 检查原始的 .. 模式
    if (filePath.includes('..')) {
      return {
        valid: false,
        error: ERROR_MESSAGES[ERROR_TYPES.PATH_TRAVERSAL].replace('{path}', filePath),
        safePath: ''
      };
    }

    // 2. 检查 URL 编码的路径遍历尝试
    try {
      const decodedPath = decodeURIComponent(filePath);
      if (decodedPath.includes('..')) {
        return {
          valid: false,
          error: ERROR_MESSAGES[ERROR_TYPES.PATH_TRAVERSAL].replace('{path}', filePath),
          safePath: ''
        };
      }
    } catch (e) {
      // URI 解码失败，视为无效路径
      return {
        valid: false,
        error: ERROR_MESSAGES[ERROR_TYPES.INVALID_PATH].replace('{path}', filePath),
        safePath: ''
      };
    }

    // 3. 检查空字节注入
    if (filePath.includes('\0')) {
      return {
        valid: false,
        error: ERROR_MESSAGES[ERROR_TYPES.PATH_TRAVERSAL].replace('{path}', filePath),
        safePath: ''
      };
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
    return normalizePath(filePath);
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
   * @param {number} maxSize - 最大大小（可选，默认使用实例配置）
   * @returns {Object} { valid: boolean, error: string|null }
   */
  _validateFileSize(content, maxSize = this.maxFileSize) {
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > maxSize) {
      const sizeMB = (contentSize / 1024 / 1024).toFixed(2);
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
      return {
        valid: false,
        error: ERROR_MESSAGES[ERROR_TYPES.FILE_TOO_LARGE]
          .replace('{size}', sizeMB)
          .replace('{maxSize}', maxSizeMB)
      };
    }
    return { valid: true, error: null };
  }

  /**
   * 标准化错误消息
   * @protected
   * @param {Error} error - 原始错误
   * @param {string} operation - 操作名称
   * @param {Object} context - 额外上下文
   * @returns {Error} 标准化错误对象
   */
  _standardizeError(error, operation, context = {}) {
    return standardizeErrorUtil(error, operation, {
      adapter: this.name,
      ...context
    });
  }

  /**
   * 处理流式命令输出
   * @protected
   * @param {Object} stream - 命令输出流
   * @param {Object} options - 选项
   * @returns {Promise<string>} 输出内容
   */
  async _readStreamOutput(stream, options = {}) {
    return readStreamOutput(stream, options);
  }

  /**
   * 解析并标准化容器路径
   * 统一处理相对路径和绝对路径，消除重复的路径清理逻辑
   * @protected
   * @param {string} filePath - 原始文件路径
   * @param {Object} options - 选项
   * @param {string} options.projectPath - 项目路径
   * @param {boolean} options.isContainerProject - 是否为容器项目
   * @returns {string} 完整的容器内路径
   * @throws {Error} 如果路径验证失败
   */
  _resolveContainerPath(filePath, options = {}) {
    const { projectPath = '', isContainerProject = false } = options;

    // 清理路径中的 ./ 和 //
    let cleanPath = normalizePath(filePath);

    // 检查是否是绝对路径（以 /workspace 开头）
    if (cleanPath.startsWith('/workspace')) {
      // 验证路径安全性
      if (cleanPath.includes('..')) {
        throw new Error('Path traversal detected');
      }
      return cleanPath;
    }

    // 相对路径处理
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }

    // 验证路径
    const validation = this._validatePath(cleanPath, options);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 构建容器路径
    return this._buildContainerPath(validation.safePath, { projectPath, isContainerProject });
  }

  /**
   * 构建容器内路径
   * @protected
   * @param {string} safePath - 安全路径
   * @param {Object} options - 选项
   * @param {string} options.projectPath - 项目路径
   * @param {boolean} options.isContainerProject - 是否为容器项目
   * @returns {string} 容器路径
   */
  _buildContainerPath(safePath, options = {}) {
    const { projectPath = '', isContainerProject = false } = options;

    // 处理当前目录 '.' 的情况
    const processedSafePath = (safePath === '.' || safePath === './') ? '' : safePath;

    let path;
    if (isContainerProject && projectPath) {
      // 容器项目：项目代码在 /workspace 下
      path = processedSafePath
        ? `${CONTAINER.paths.workspace}/${projectPath}/${processedSafePath}`
        : `${CONTAINER.paths.workspace}/${projectPath}`;
    } else if (projectPath) {
      // 会话项目：使用 .claude/projects
      path = processedSafePath
        ? `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}/${processedSafePath}`
        : `${CONTAINER.paths.projects}/${PathUtils.encodeProjectName(projectPath)}`;
    } else {
      // 默认：workspace
      path = processedSafePath
        ? `${CONTAINER.paths.workspace}/${processedSafePath}`
        : CONTAINER.paths.workspace;
    }

    return path.replace(/\/+/g, '/');
  }

  /**
   * 获取适配器信息
   * @returns {Object} 适配器信息
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      type: this.getType(),
      maxFileSize: this.maxFileSize,
      excludedDirs: this.excludedDirs
    };
  }

  /**
   * 清理文件名（暴露给子类使用）
   * @protected
   * @param {string} name - 原始文件名
   * @returns {string} 清理后的文件名
   */
  _cleanFileName(name) {
    return cleanFileName(name);
  }

  /**
   * 验证文件名是否有效（暴露给子类使用）
   * @protected
   * @param {string} name - 文件名
   * @returns {boolean} 是否有效
   */
  _isValidFileName(name) {
    return isValidFileName(name);
  }

  /**
   * 检查是否为隐藏文件（暴露给子类使用）
   * @protected
   * @param {string} name - 文件名
   * @returns {boolean} 是否为隐藏文件
   */
  _isHiddenFile(name) {
    return isHiddenFile(name);
  }

  /**
   * 判断路径是否为目录（暴露给子类使用）
   * @protected
   * @param {string} fullPath - 完整路径
   * @param {Set<string>} allPaths - 所有路径集合
   * @returns {boolean} 是否为目录
   */
  _isDirectory(fullPath, allPaths) {
    return isDirectory(fullPath, allPaths);
  }

  /**
   * 创建文件树节点（暴露给子类使用）
   * @protected
   * @param {Object} options - 节点配置
   * @returns {Object} 文件树节点
   */
  _createTreeNode(options) {
    return createTreeNode(options);
  }
}

export default BaseFileAdapter;
