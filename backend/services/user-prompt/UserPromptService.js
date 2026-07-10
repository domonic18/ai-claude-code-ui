/**
 * UserPromptService.js
 *
 * 用户提示词管理服务
 * 提供用户级提示词文件的读取和写入功能
 *
 * @module services/user-prompt/UserPromptService
 */

import { readFileInContainer, writeFileInContainer } from '../files/utils/index.js';
import { DEFAULT_USER_PROMPT_TEMPLATE } from '../../shared/constants/user-prompt.js';

/**
 * 用户提示词文件路径（容器内绝对路径）
 * 放在 /workspace/.claude/user-prompt/ 目录下（用户级提示词，跨项目共享）
 * 使用绝对路径，确保后端和 SDK 都能正确访问
 */
export const USER_PROMPT_FILE_PATH = '/workspace/.claude/user-prompt/user-prompt.md';

/**
 * 旧版文件路径（向后兼容：读取兜底，保障老用户数据不丢失）
 * 历史路径 /workspace/.claude/memory/MEMORY.md，新路径不存在时回退读取
 */
const LEGACY_MEMORY_FILE_PATH = '/workspace/.claude/memory/MEMORY.md';

/**
 * 用户提示词管理服务类
 */
export class UserPromptService {
  /**
   * 构造函数
   */
  constructor() {
    this.userPromptPath = USER_PROMPT_FILE_PATH;
  }

  /**
   * 读取用户提示词文件
   * 读取兜底链：新路径 → 旧版 MEMORY.md 路径（老用户数据迁移保障）→ 默认模板
   * @param {number} userId - 用户 ID
   * @param {object} options - 选项
   * @returns {Promise<{content: string, path: string}>}
   */
  async readUserPrompt(userId, options = {}) {
    try {
      const result = await readFileInContainer(userId, this.userPromptPath, options);
      return result;
    } catch (error) {
      // 新路径文件不存在：先回退读旧版 MEMORY.md（老用户数据兜底），再退回默认模板
      if (error.code === 'ENOENT' || error.message.includes('not found')) {
        try {
          const legacy = await readFileInContainer(userId, LEGACY_MEMORY_FILE_PATH, options);
          if (legacy && legacy.content) {
            return { content: legacy.content, path: this.userPromptPath };
          }
        } catch (legacyError) {
          // 旧路径也不存在，忽略并继续返回默认模板
        }
        return {
          content: DEFAULT_USER_PROMPT_TEMPLATE,
          path: this.userPromptPath
        };
      }
      throw error;
    }
  }

  /**
   * 写入用户提示词文件
   * @param {number} userId - 用户 ID
   * @param {string} content - 用户提示词内容
   * @param {object} options - 选项
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeUserPrompt(userId, content, options = {}) {
    // 验证 content 参数
    if (content === undefined || content === null) {
      throw new Error('Content is required');
    }

    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    return await writeFileInContainer(userId, this.userPromptPath, content, options);
  }

  /**
   * 获取用户提示词文件路径
   * @returns {string}
   */
  getUserPromptPath() {
    return this.userPromptPath;
  }

  /**
   * 获取默认用户提示词模板
   * @returns {string}
   */
  getDefaultTemplate() {
    return DEFAULT_USER_PROMPT_TEMPLATE;
  }
}

// 导出单例实例
export default new UserPromptService();
