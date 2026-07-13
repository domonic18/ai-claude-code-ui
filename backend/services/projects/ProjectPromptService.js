/**
 * ProjectPromptService.js
 *
 * 项目级提示词服务
 * 提供单个项目的提示词文件（.project-prompt.md）读取与写入。
 * 仿 UserPromptService，作用域为单个项目：/workspace/<项目名>/.project-prompt.md
 *
 * 设计要点：
 * - 文件优先，不入数据库
 * - 不主动预建文件；首次保存时由 FileWriter.write 自动创建（含父目录）
 * - 内容为空 / 文件不存在时，读取兜底返回空字符串
 *
 * @module services/projects/ProjectPromptService
 */

import { readFileInContainer, writeFileInContainer } from '../files/utils/index.js';
import { PathUtils, PathValidator } from '../core/utils/path-utils.js';
import { CONTAINER } from '../../config/config.js';
import { ValidationError } from '../../middleware/error-handler.middleware.js';

/**
 * 项目提示词文件名（隐藏文件，位于项目根目录）
 */
const PROJECT_PROMPT_FILENAME = '.project-prompt.md';

/**
 * 构建项目提示词的容器内绝对路径，并做路径安全校验
 * @param {string} projectName - 项目名称（原始名，来自 URL 参数）
 * @returns {string} 容器内绝对路径 /workspace/<项目名>/.project-prompt.md
 * @throws {ValidationError} 项目名非法或存在路径穿越时抛出（→ HTTP 400）
 */
function buildPromptPath(projectName) {
  // 1. 字符合法性校验：拒绝 / \ : " | ? * 控制字符 等（PathValidator.validateProjectName）
  const { valid, error } = PathValidator.validateProjectName(projectName);
  if (!valid) {
    throw new ValidationError(error);
  }
  // 2. 防路径穿越：safeJoin 保证最终路径仍严格位于 workspace 之下（兜住 ".." 等）
  try {
    return PathUtils.safeJoin(CONTAINER.paths.workspace, projectName, PROJECT_PROMPT_FILENAME);
  } catch (traversalError) {
    throw new ValidationError('Invalid project name');
  }
}

/**
 * 项目提示词服务类
 */
export class ProjectPromptService {
  /**
   * 读取项目提示词
   * @param {number} userId - 用户 ID
   * @param {string} projectName - 项目名称
   * @param {object} options - 选项（透传给 readFileInContainer）
   * @returns {Promise<{content: string, path: string}>} content 为空字符串表示无提示词
   */
  async readProjectPrompt(userId, projectName, options = {}) {
    const filePath = buildPromptPath(projectName);
    try {
      return await readFileInContainer(userId, filePath, options);
    } catch (error) {
      // 老项目 / 未保存过：文件不存在 → 兜底返回空（保持只读语义，不创建文件）
      if (error.code === 'ENOENT' || /not found|no such file/i.test(error.message)) {
        return { content: '', path: filePath };
      }
      throw error;
    }
  }

  /**
   * 写入项目提示词
   * 首次写入即创建文件（FileWriter.write 内部会 mkdir -p 父目录并重定向写入）
   * @param {number} userId - 用户 ID
   * @param {string} projectName - 项目名称
   * @param {string} content - 提示词内容
   * @param {object} options - 选项（透传给 writeFileInContainer）
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async writeProjectPrompt(userId, projectName, content, options = {}) {
    if (typeof content !== 'string') {
      throw new ValidationError('Content must be a string');
    }
    const filePath = buildPromptPath(projectName);
    return await writeFileInContainer(userId, filePath, content, options);
  }

  /**
   * 获取项目提示词文件路径（仅供调试/日志使用）
   * @param {string} projectName - 项目名称
   * @returns {string}
   */
  getPromptPath(projectName) {
    return buildPromptPath(projectName);
  }
}

// 导出单例实例
export default new ProjectPromptService();
