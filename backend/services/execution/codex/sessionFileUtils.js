/**
 * sessionFileUtils.js
 *
 * Codex 会话文件查找与路径匹配工具 — 从 sessions.js 提取
 *
 * @module services/execution/codex/sessionFileUtils
 */

import path from 'path';
import { promises as fs } from 'fs';

/**
 * 递归查找所有 JSONL 文件
 * @param {string} dir - 目录路径
 * @returns {Promise<string[]>} JSONL 文件路径数组
 */
export async function findJsonlFiles(dir) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await findJsonlFiles(fullPath));
      } else if (entry.name.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // 跳过无法读取的目录
  }
  return files;
}

/**
 * 检查会话是否属于指定项目（兼容 Windows 长路径）
 * @param {Object} sessionData - 会话数据
 * @param {string} projectPath - 项目路径
 * @returns {boolean}
 */
export function isSessionInProject(sessionData, projectPath) {
  const sessionCwd = sessionData?.cwd || '';

  const cleanSessionCwd = sessionCwd.startsWith('\\\\?\\')
    ? sessionCwd.slice(4)
    : sessionCwd;
  const cleanProjectPath = projectPath.startsWith('\\\\?\\')
    ? projectPath.slice(4)
    : projectPath;

  return sessionCwd === projectPath ||
    cleanSessionCwd === cleanProjectPath ||
    path.relative(cleanSessionCwd, cleanProjectPath) === '';
}
