/**
 * MemoryService.js
 *
 * 记忆管理服务
 * 提供长期记忆文件的读取和写入功能
 *
 * @module services/memory/MemoryService
 */

import { readFileInContainer, writeFileInContainer } from '../files/utils/index.js';
import { DEFAULT_MEMORY_TEMPLATE } from '../../shared/constants/memory.js';

/**
 * 记忆文件路径
 * 放在 /workspace/.claude/memory/ 目录下（用户级记忆，跨项目共享）
 * 使用绝对路径，确保后端和 SDK 都能正确访问
 */
const MEMORY_FILE_PATH = '/workspace/.claude/memory/MEMORY.md';

/**
 * 记忆管理服务类
 */
export class MemoryService {
  /**
   * 构造函数
   */
  constructor() {
    this.memoryPath = MEMORY_FILE_PATH;
  }

  /**
   * 读取记忆文件
   * @param {number} userId - 用户 ID
   * @param {object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   */
  async readMemory(userId, options = {}) {
    try {
      const result = await readFileInContainer(userId, this.memoryPath, options);
      return result;
    } catch (error) {
      // 如果文件不存在，返回默认模板
      if (error.code === 'ENOENT' || error.message.includes('not found')) {
        return {
          content: DEFAULT_MEMORY_TEMPLATE,
          path: this.memoryPath
        };
      }
      throw error;
    }
  }

  /**
   * 写入记忆文件
   * @param {number} userId - 用户 ID
   * @param {string} content - 记忆内容
   * @param {object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeMemory(userId, content, options = {}) {
    // 验证 content 参数
    if (content === undefined || content === null) {
      throw new Error('Content is required');
    }

    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    return await writeFileInContainer(userId, this.memoryPath, content, options);
  }

  /**
   * 获取记忆文件路径
   * @returns {string}
   */
  getMemoryPath() {
    return this.memoryPath;
  }

  /**
   * 获取默认记忆模板
   * @returns {string}
   */
  getDefaultTemplate() {
    return DEFAULT_MEMORY_TEMPLATE;
  }
}

// 导出单例实例
export default new MemoryService();
