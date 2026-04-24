/**
 * MemoryLoader.js
 *
 * 记忆加载器 - 按优先级构建上下文
 *
 * 优先级顺序（从高到低）:
 * 1. 当前命令
 * 2. MEMORY.md
 * 3. Skills
 *
 * @module services/memory/MemoryLoader
 */

import { MemoryService } from './MemoryService.js';
import { createLogger } from '../../utils/logger.js';
const logger = createLogger('services/memory/MemoryLoader');

/**
 * 记忆加载器类
 */
export class MemoryLoader {
  /**
   * 构造函数
   * @param {number} userId - 用户 ID
   * @param {Object} options - 选项
   * @param {number} options.maxTokens - 最大 token 数量（默认 20000）
   * @param {boolean} options.includeMemory - 是否包含长期记忆（默认 true）
   */
  constructor(userId, options = {}) {
    this.userId = userId;
    this.maxTokens = options.maxTokens || 20000;
    this.includeMemory = options.includeMemory !== false;

    this.memoryService = new MemoryService(userId);
  }

  /**
   * 构建完整的上下文
   * @param {string} currentCommand - 当前用户命令
   * @param {Object} options - 选项
   * @param {string} options.projectContext - 项目上下文
   * @param {Array<string>} options.skills - 可用的 skills 列表
   * @returns {Promise<{context: string, sources: Array<{type: string, name: string, included: boolean, size: number}>}>}
   */
  async buildContext(currentCommand, options = {}) {
    const { projectContext = '', skills = [] } = options;

    const parts = [];
    const sources = [];

    // 1. 当前命令（最高优先级，始终包含）
    const commandPart = `## 当前任务\n${currentCommand}`;
    parts.push({ content: commandPart, priority: 1, type: 'command', name: 'current-command' });
    sources.push({ type: 'command', name: '当前命令', included: true, size: commandPart.length });

    // 2. 长期记忆 (MEMORY.md)
    if (this.includeMemory) {
      const { content: memoryContent } = await this.memoryService.readMemory();
      if (memoryContent) {
        parts.push({
          content: `---\n\n## 用户长期记忆\n${memoryContent}`,
          priority: 2,
          type: 'memory',
          name: 'MEMORY.md'
        });
        sources.push({
          type: 'memory',
          name: '长期记忆',
          included: true,
          size: memoryContent.length
        });
      } else {
        sources.push({
          type: 'memory',
          name: '长期记忆',
          included: false,
          size: 0
        });
      }
    }

    // 3. 项目上下文
    if (projectContext) {
      parts.push({
        content: `---\n\n## 项目上下文\n${projectContext}`,
        priority: 3,
        type: 'project',
        name: 'project-context'
      });
      sources.push({
        type: 'project',
        name: '项目上下文',
        included: true,
        size: projectContext.length
      });
    }

    // 4. Skills（最低优先级）
    if (skills.length > 0) {
      const skillsPart = `---\n\n## 可用 Skills\n${skills.map(s => `- ${s}`).join('\n')}`;
      parts.push({
        content: skillsPart,
        priority: 4,
        type: 'skills',
        name: 'available-skills'
      });
      sources.push({
        type: 'skills',
        name: '可用 Skills',
        included: true,
        size: skillsPart.length
      });
    }

    // 按优先级合并内容
    const sortedParts = parts.sort((a, b) => a.priority - b.priority);
    let finalContext = sortedParts.map(p => p.content).join('\n');

    // Token 预算管理
    const estimatedTokens = this._estimateTokens(finalContext);

    if (estimatedTokens > this.maxTokens) {
      // 从低优先级开始截断
      finalContext = this._truncateByPriority(sortedParts, this.maxTokens);
      logger.debug({ from: estimatedTokens, to: this._estimateTokens(finalContext) }, 'Context truncated due to token limit');
    }

    return {
      context: finalContext,
      sources,
      estimatedTokens: this._estimateTokens(finalContext)
    };
  }

  /**
   * 获取记忆内容摘要
   * @returns {Promise<{memory: {exists: boolean, content: string|null}}>}
   */
  async getMemorySummary() {
    const memoryResult = await this.memoryService.readMemory();

    return {
      memory: memoryResult
    };
  }

  /**
   * 按 token 预算截断上下文
   * @param {Array} parts - 内容部分
   * @param {number} maxTokens - 最大 token 数量
   * @returns {string} 截断后的内容
   * @private
   */
  _truncateByPriority(parts, maxTokens) {
    let currentTokens = 0;
    const includedParts = [];

    // 按优先级从高到低处理
    for (const part of parts.sort((a, b) => a.priority - b.priority)) {
      const partTokens = this._estimateTokens(part.content);

      if (currentTokens + partTokens <= maxTokens) {
        includedParts.push(part);
        currentTokens += partTokens;
      }
    }

    return includedParts.map(p => p.content).join('\n');
  }

  /**
   * 估算 token 数量
   * @param {string} text - 文本
   * @returns {number} 估算的 token 数量
   * @private
   */
  _estimateTokens(text) {
    // 粗略估算：英文约 4 字符/token，中文约 1.5 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}

export default MemoryLoader;
