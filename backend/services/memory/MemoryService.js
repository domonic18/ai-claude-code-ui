/**
 * MemoryService.js
 *
 * 记忆管理服务
 * 提供长期记忆文件的读取和写入功能
 *
 * @module services/memory/MemoryService
 */

import { readFileInContainer, writeFileInContainer } from '../files/utils/index.js';

/**
 * 记忆文件路径
 * 放在 /workspace/memory/ 目录下
 */
const MEMORY_FILE_PATH = 'memory/MEMORY.md';

/**
 * 默认记忆模板
 */
const DEFAULT_MEMORY_TEMPLATE = `# Memory

## 审查风格
- 代码审查时注重安全性、性能和可维护性
- 遵循项目编码规范和最佳实践
- 提供建设性的改进建议

## 常见问题答复规则
- 回答简洁明了，直接针对问题
- 提供可操作的解决方案
- 必要时提供代码示例

## 用户偏好
- 优先使用项目现有的库和框架
- 保持代码简洁，避免过度设计
- 注重代码的可读性和可维护性

## 工作模式偏好
- 先分析需求，再设计方案
- 小步快跑，频繁验证
- 及时沟通，确认方向
`;

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
