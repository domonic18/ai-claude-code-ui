/**
 * 容器文件操作模块
 *
 * 提供容器内的文件读写、统计和删除功能
 * 这是 FileAdapter 的薄包装层，提供函数式 API
 *
 * @module files/utils/container-ops
 */

import { FileAdapter } from '../adapters/FileAdapter.js';

// 单例 FileAdapter 实例
let _fileAdapter = null;

/**
 * 获取 FileAdapter 单例实例
 * @returns {FileAdapter}
 */
function getFileAdapter() {
  if (!_fileAdapter) {
    _fileAdapter = new FileAdapter();
  }
  return _fileAdapter;
}

/**
 * 从容器内读取文件内容
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径（相对于项目根目录）
 * @param {object} options - 选项
 * @param {string} options.encoding - 编码，默认 'utf8'
 * @param {string} options.projectPath - 项目路径
 * @param {boolean} options.isContainerProject - 是否为容器项目
 * @returns {Promise<{content: string, path: string}>}
 */
export async function readFileInContainer(userId, filePath, options = {}) {
  const adapter = getFileAdapter();
  return adapter.readFile(filePath, { userId, ...options });
}

/**
 * 在容器内写入文件内容
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径（相对于项目根目录）
 * @param {string} content - 要写入的文件内容
 * @param {object} options - 选项
 * @param {string} options.encoding - 编码，默认 'utf8'
 * @param {string} options.projectPath - 项目路径
 * @param {boolean} options.isContainerProject - 是否为容器项目
 * @returns {Promise<{success: boolean, path: string}>}
 */
export async function writeFileInContainer(userId, filePath, content, options = {}) {
  const adapter = getFileAdapter();
  return adapter.writeFile(filePath, content, { userId, ...options });
}

/**
 * 从容器内获取文件统计信息
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径
 * @param {object} options - 选项
 * @param {string} options.projectPath - 项目路径
 * @returns {Promise<object>} 文件统计信息
 */
export async function getFileStatsInContainer(userId, filePath, options = {}) {
  const adapter = getFileAdapter();
  return adapter.getFileStats(filePath, { userId, ...options });
}

/**
 * 从容器内删除文件
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径
 * @param {object} options - 选项
 * @param {string} options.projectPath - 项目路径
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteFileInContainer(userId, filePath, options = {}) {
  const adapter = getFileAdapter();
  return adapter.deleteFile(filePath, { userId, ...options });
}

/**
 * 检查容器内文件是否存在
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径
 * @param {object} options - 选项
 * @returns {Promise<boolean>}
 */
export async function fileExistsInContainer(userId, filePath, options = {}) {
  const adapter = getFileAdapter();
  return adapter.fileExists(filePath, { userId, ...options });
}

/**
 * 在容器内创建目录
 * @param {number} userId - 用户 ID
 * @param {string} dirPath - 目录路径
 * @param {object} options - 选项
 * @param {boolean} options.recursive - 是否递归创建，默认 true
 * @returns {Promise<{success: boolean, path: string}>}
 */
export async function createDirectoryInContainer(userId, dirPath, options = {}) {
  const adapter = getFileAdapter();
  return adapter.createDirectory(dirPath, { userId, ...options });
}
