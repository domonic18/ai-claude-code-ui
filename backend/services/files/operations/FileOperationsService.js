/**
 * FileOperationsService.js
 *
 * 统一文件操作服务
 * 使用容器化的文件操作适配器
 *
 * @module files/operations/FileOperationsService
 */

import { FileAdapter } from '../adapters/FileAdapter.js';

/**
 * 文件操作服务类
 * 提供统一的文件操作接口
 */
export class FileOperationsService {
  /**
   * 构造函数
   * @param {Object} config - 服务配置
   */
  constructor(config = {}) {
    this.config = config;
    this.adapter = new FileAdapter(config);
  }

  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   */
  async readFile(filePath, options = {}) {
    return await this.adapter.readFile(filePath, options);
  }

  /**
   * 写入文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeFile(filePath, content, options = {}) {
    return await this.adapter.writeFile(filePath, content, options);
  }

  /**
   * 获取文件树结构
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 文件树
   */
  async getFileTree(dirPath, options = {}) {
    return await this.adapter.getFileTree(dirPath, options);
  }

  /**
   * 获取文件统计信息
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 文件统计信息
   */
  async getFileStats(filePath, options = {}) {
    return await this.adapter.getFileStats(filePath, options);
  }

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filePath, options = {}) {
    return await this.adapter.deleteFile(filePath, options);
  }

  /**
   * 重命名文件或目录
   * @param {string} oldPath - 旧路径
   * @param {string} newName - 新名称
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, newPath: string}>}
   */
  async renameFile(oldPath, newName, options = {}) {
    return await this.adapter.renameFile(oldPath, newName, options);
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath, options = {}) {
    return await this.adapter.fileExists(filePath, options);
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createDirectory(dirPath, options = {}) {
    return await this.adapter.createDirectory(dirPath, options);
  }

  /**
   * 获取服务信息
   * @returns {Object} 服务信息
   */
  getInfo() {
    return {
      adapter: this.adapter.getInfo(),
      mode: 'container'
    };
  }
}

// 默认导出单例
export default new FileOperationsService();
