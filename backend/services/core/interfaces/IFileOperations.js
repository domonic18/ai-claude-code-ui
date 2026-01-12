/**
 * IFileOperations.js
 *
 * 文件操作接口 - 统一容器和非容器文件操作
 *
 * @module core/interfaces/IFileOperations
 */

/**
 * 文件操作接口
 * 定义了文件系统操作的核心方法，支持容器和非容器模式
 */
export class IFileOperations {
  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @param {string} [options.encoding='utf8'] - 文件编码
   * @param {boolean} [options.isBase64=false] - 是否返回 base64 编码
   * @returns {Promise<{content: string, path: string, size: number}>}
   */
  async readFile(filePath, options = {}) {
    throw new Error('IFileOperations.readFile() must be implemented');
  }

  /**
   * 写入文件
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @param {string} [options.encoding='utf8'] - 文件编码
   * @param {boolean} [options.isBase64=false] - 内容是否为 base64 编码
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeFile(filePath, content, options = {}) {
    throw new Error('IFileOperations.writeFile() must be implemented');
  }

  /**
   * 获取文件树
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @param {number} [options.maxDepth=3] - 最大深度
   * @param {Array<string>} [options.excludedDirs=[]] - 排除的目录
   * @returns {Promise<Array>} 文件树结构
   */
  async getFileTree(dirPath, options = {}) {
    throw new Error('IFileOperations.getFileTree() must be implemented');
  }

  /**
   * 获取文件统计信息
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 文件统计信息
   */
  async getFileStats(filePath, options = {}) {
    throw new Error('IFileOperations.getFileStats() must be implemented');
  }

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 选项
   * @param {boolean} [options.recursive=false] - 是否递归删除目录
   * @returns {Promise<{success: boolean}>}
   */
  async deleteFile(filePath, options = {}) {
    throw new Error('IFileOperations.deleteFile() must be implemented');
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    throw new Error('IFileOperations.fileExists() must be implemented');
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @param {boolean} [options.recursive=true] - 是否递归创建
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async createDirectory(dirPath, options = {}) {
    throw new Error('IFileOperations.createDirectory() must be implemented');
  }

  /**
   * 获取操作类型
   * @returns {string} 'native' | 'container'
   */
  getType() {
    throw new Error('IFileOperations.getType() must be implemented');
  }
}

/**
 * 文件读取结果类型定义
 * @typedef {Object} FileReadResult
 * @property {string} content - 文件内容
 * @property {string} path - 文件路径
 * @property {number} size - 文件大小（字节）
 * @property {string} [encoding] - 文件编码
 */

/**
 * 文件树节点类型定义
 * @typedef {Object} FileTreeNode
 * @property {string} name - 文件/目录名
 * @property {string} path - 完整路径
 * @property {string} type - 'file' | 'directory'
 * @property {number} [size] - 文件大小（字节）
 * @property {Array<FileTreeNode>} [children] - 子节点（目录）
 * @property {number} [depth] - 深度
 */

/**
 * 文件统计信息类型定义
 * @typedef {Object} FileStats
 * @property {number} size - 文件大小（字节）
 * @property {Date} mtime - 最后修改时间
 * @property {Date} ctime - 创建时间
 * @property {boolean} isFile - 是否为文件
 * @property {boolean} isDirectory - 是否为目录
 * @property {string} [permissions] - 文件权限
 */

export default IFileOperations;
