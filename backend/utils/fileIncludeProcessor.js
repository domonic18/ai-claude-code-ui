/**
 * fileIncludeProcessor.js
 *
 * 文件包含处理器
 *
 * 处理内容中的文件包含（@filename 语法），从 commandParser.js 提取以降低复杂度
 *
 * @module utils/fileIncludeProcessor
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * 最大包含深度
 * @type {number}
 */
const MAX_INCLUDE_DEPTH = 3;

// 工具函数，供多个模块调用
/**
 * 验证文件路径以防止目录遍历攻击
 * @param {string} filePath - 要验证的路径
 * @param {string} basePath - 基础目录路径
 * @returns {boolean} 如果路径安全则返回 true
 */
export function isPathSafe(filePath, basePath) {
  const resolvedPath = path.resolve(basePath, filePath);
  const resolvedBase = path.resolve(basePath);
  const relative = path.relative(resolvedBase, resolvedPath);
  return (
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}

// 工具函数，供多个模块调用
/**
 * 处理内容中的文件包含（@filename 语法）
 * @param {string} content - 包含 @filename 包含的内容
 * @param {string} basePath - 用于解析文件路径的基础目录
 * @param {number} depth - 当前递归深度
 * @returns {Promise<string>} 解析包含后的内容
 */
export async function processFileIncludes(content, basePath, depth = 0) {
  if (!content) return content;

  // 防止无限递归
  if (depth >= MAX_INCLUDE_DEPTH) {
    throw new Error(`超过最大包含深度 (${MAX_INCLUDE_DEPTH})`);
  }

  // 匹配 @filename 模式（在行首或空格后）
  const includePattern = /(?:^|\s)@([^\s]+)/gm;
  const matches = [...content.matchAll(includePattern)];

  if (matches.length === 0) {
    return content;
  }

  let result = content;

  for (const match of matches) {
    const fullMatch = match[0];
    const filename = match[1];

    // 安全性：防止目录遍历
    if (!isPathSafe(filename, basePath)) {
      throw new Error(`无效的文件路径（检测到目录遍历攻击）: ${filename}`);
    }

    try {
      const filePath = path.resolve(basePath, filename);
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // 递归处理包含文件中的包含
      const processedContent = await processFileIncludes(fileContent, basePath, depth + 1);

      // 用文件内容替换 @filename
      result = result.replace(fullMatch, fullMatch.startsWith(' ') ? ' ' + processedContent : processedContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`文件未找到: ${filename}`);
      }
      throw error;
    }
  }

  return result;
}

