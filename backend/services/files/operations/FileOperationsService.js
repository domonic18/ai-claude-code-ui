/**
 * FileOperationsService.js
 *
 * 统一文件操作服务
 * 根据容器模式自动选择合适的文件操作适配器
 *
 * @module files/operations/FileOperationsService
 */

import { NativeFileAdapter } from '../adapters/NativeFileAdapter.js';
import { ContainerFileAdapter } from '../adapters/ContainerFileAdapter.js';
import { CONTAINER } from '../../../config/config.js';

/**
 * 文件操作服务类
 * 提供统一的文件操作接口，自动适配容器/非容器模式
 */
export class FileOperationsService {
  /**
   * 构造函数
   * @param {Object} config - 服务配置
   */
  constructor(config = {}) {
    this.config = config;
    this.nativeAdapter = new NativeFileAdapter(config);
    this.containerAdapter = new ContainerFileAdapter(config);
  }

  /**
   * 获取当前适配器
   * @private
   * @param {Object} options - 选项
   * @returns {BaseFileAdapter} 文件适配器
   */
  _getAdapter(options = {}) {
    const isContainerMode = options.containerMode ?? CONTAINER.enabled;
    return isContainerMode ? this.containerAdapter : this.nativeAdapter;
  }

  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   */
  async readFile(filePath, options = {}) {
    const adapter = this._getAdapter(options);
    return await adapter.readFile(filePath, options);
  }

  /**
   * 写入文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeFile(filePath, content, options = {}) {
    const adapter = this._getAdapter(options);
    return await adapter.writeFile(filePath, content, options);
  }

  /**
   * 获取文件树结构
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 文件树
   */
  async getFileTree(dirPath, options = {}) {
    const adapter = this._getAdapter(options);
    return await adapter.getFileTree(dirPath, options);
  }

  /**
   * 获取文件统计信息
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 文件统计信息
   */
  async getFileStats(filePath, options = {}) {
    const adapter = this._getAdapter(options);
    return await adapter.getFileStats(filePath, options);
  }

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filePath, options = {}) {
    const adapter = this._getAdapter(options);
    return await adapter.deleteFile(filePath, options);
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath, options = {}) {
    const adapter = this._getAdapter(options);
    return await adapter.fileExists(filePath, options);
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createDirectory(dirPath, options = {}) {
    const adapter = this._getAdapter(options);
    return await adapter.createDirectory(dirPath, options);
  }

  /**
   * 获取服务信息
   * @returns {Object} 服务信息
   */
  getInfo() {
    return {
      nativeAdapter: this.nativeAdapter.getInfo(),
      containerAdapter: this.containerAdapter.getInfo(),
      currentMode: CONTAINER.enabled ? 'container' : 'native'
    };
  }
}

// 默认导出单例
export default new FileOperationsService();
