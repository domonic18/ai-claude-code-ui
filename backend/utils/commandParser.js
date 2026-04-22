import matter from 'gray-matter';
import { validateCommand } from './commandValidators.js';
import { processFileIncludes } from './fileIncludeProcessor.js';
import { replaceArguments, sanitizeOutput, processBashCommands } from './commandProcessors.js';

// Re-export extracted functions for backward compatibility
export { validateCommand } from './commandValidators.js';
export { processFileIncludes, isPathSafe } from './fileIncludeProcessor.js';
export { replaceArguments, sanitizeOutput, processBashCommands };

// 工具函数，供多个模块调用
/**
 * 解析 markdown 命令文件并提取 frontmatter 和内容
 * @param {string} content - 原始 markdown 内容
 * @returns {object} 解析后的命令，包含 data（frontmatter）和 content
 */
export function parseCommand(content) {
  try {
    const parsed = matter(content);
    return {
      data: parsed.data || {},
      content: parsed.content || '',
      raw: content
    };
  } catch (error) {
    throw new Error(`解析命令失败: ${error.message}`);
  }
}

