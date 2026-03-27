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
 * 放在 /workspace/.claude/memory/ 目录下
 */
const MEMORY_FILE_PATH = '.claude/memory/MEMORY.md';

/**
 * 默认记忆模板
 */
const DEFAULT_MEMORY_TEMPLATE = `  # Memory - 专利助手

  ## 专业背景
  - 工作领域：[填写专业领域，如教育/电子/化工/生物医疗等]
  - 执照资格：[专利代理人/律师]
  - 主要服务：[国内专利/国际专利/PCT申请等]

  ## 技术领域知识
  - 熟悉的技术领域：[列出专业领域]
  - 常用术语：[列出技术术语及解释]
  - 需要注意的技术难点：[行业特殊问题]

  ## 法律条文参考
  - 中国专利法重点条款：[常用的法条]
  - 专利审查指南相关章节：[常用章节]
  - PCT条约相关内容：[如涉及]
  - 其他国家专利法：[如涉及]

  ## 工作流程偏好
  - 文档撰写风格：[详细/简洁/侧重法律/侧重技术]
  - 审查意见答复策略：[强硬/温和/折中]
  - 客户沟通方式：[正式/友好/专业术语为主]
  - 权利要求撰写偏好：[从属权利要求层数/保护范围偏好]

  ## 常见问题处理
  - 新颖性/创造性答复技巧：[经验总结]
  - 形式问题处理：[常用解决方法]
  - 审查员常见异议：[应对策略]

  ## 检索偏好
  - 使用的主要检索数据库：[CNIPA/Google Patents/WIPO等]
  - 检索关键词偏好：[行业术语/同义词]
  - 对比文件分析思路：[重点关注方面]

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
