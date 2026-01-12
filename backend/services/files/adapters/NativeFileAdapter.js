/**
 * NativeFileAdapter.js
 *
 * 原生文件操作适配器
 * 直接在主机上执行文件操作
 *
 * @module files/adapters/NativeFileAdapter
 */

import { BaseFileAdapter } from './BaseFileAdapter.js';
import { promises as fs } from 'fs';
import path from 'path';
import { CONTAINER } from '../../../config/config.js';
import { PathUtils } from '../../core/utils/path-utils.js';

/**
 * 最大文件大小 (50MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * 原生文件操作适配器
 * 直接在主机上执行文件读写操作
 */
export class NativeFileAdapter extends BaseFileAdapter {
  /**
   * 构造函数
   * @param {Object} config - 适配器配置
   */
  constructor(config = {}) {
    super({
      name: 'NativeFileAdapter',
      version: '1.0.0',
      ...config
    });
    this.adapterType = 'native';
  }

  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   */
  async readFile(filePath, options = {}) {
    const { encoding = 'utf8', projectPath = '' } = options;

    try {
      // 验证路径
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 构建完整路径
      const fullPath = this._buildFullPath(process.cwd(), validation.safePath);

      // 读取文件
      const content = await fs.readFile(fullPath, encoding);

      return {
        content: content.replace(/\s+$/, ''), // 移除尾部空白
        path: fullPath
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
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
    const { encoding = 'utf8', projectPath = '' } = options;

    try {
      // 验证路径
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 验证文件大小
      const sizeValidation = this._validateFileSize(content, MAX_FILE_SIZE);
      if (!sizeValidation.valid) {
        throw new Error(sizeValidation.error);
      }

      // 构建完整路径
      const fullPath = this._buildFullPath(process.cwd(), validation.safePath);

      // 确保目录存在
      const dirPath = path.dirname(fullPath);
      await fs.mkdir(dirPath, { recursive: true });

      // 写入文件
      await fs.writeFile(fullPath, content, encoding);

      return {
        success: true,
        path: fullPath
      };
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
    const {
      maxDepth = 3,
      excludedDirs = ['.git', 'node_modules', 'dist', 'build', '.next', '.nuxt', 'target', 'bin', 'obj']
    } = options;

    try {
      // 验证路径
      const validation = this._validatePath(dirPath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 构建完整路径
      const fullPath = this._buildFullPath(process.cwd(), validation.safePath);

      // 递归读取目录
      const tree = await this._readDirectory(fullPath, 0, maxDepth, excludedDirs);

      return tree;
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
    try {
      // 验证路径
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 构建完整路径
      const fullPath = this._buildFullPath(process.cwd(), validation.safePath);

      // 获取文件状态
      const stats = await fs.stat(fullPath);

      return {
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        mode: stats.mode.toString(8),
        created: stats.birthtime.toISOString()
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw this._standardizeError(error, 'getFileStats');
    }
  }

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filePath, options = {}) {
    try {
      // 验证路径
      const validation = this._validatePath(filePath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 构建完整路径
      const fullPath = this._buildFullPath(process.cwd(), validation.safePath);

      // 删除文件或目录
      await fs.rm(fullPath, { recursive: true, force: true });

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
      const validation = this._validatePath(filePath);
      if (!validation.valid) {
        return false;
      }

      const fullPath = this._buildFullPath(process.cwd(), validation.safePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createDirectory(dirPath, options = {}) {
    const { recursive = true } = options;

    try {
      // 验证路径
      const validation = this._validatePath(dirPath, options);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 构建完整路径
      const fullPath = this._buildFullPath(process.cwd(), validation.safePath);

      // 创建目录
      await fs.mkdir(fullPath, { recursive });

      return {
        success: true,
        path: fullPath
      };
    } catch (error) {
      throw this._standardizeError(error, 'createDirectory');
    }
  }

  /**
   * 递归读取目录
   * @private
   * @param {string} dirPath - 目录路径
   * @param {number} currentDepth - 当前深度
   * @param {number} maxDepth - 最大深度
   * @param {Array<string>} excludedDirs - 排除的目录
   * @returns {Promise<Array>} 文件树
   */
  async _readDirectory(dirPath, currentDepth, maxDepth, excludedDirs) {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
      // 跳过排除的目录
      if (entry.isDirectory() && excludedDirs.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const item = {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: fullPath
      };

      if (entry.isDirectory()) {
        try {
          item.children = await this._readDirectory(fullPath, currentDepth + 1, maxDepth, excludedDirs);
        } catch {
          // 跳过无法访问的目录
          item.children = [];
        }
      }

      result.push(item);
    }

    return result;
  }
}

export default NativeFileAdapter;
