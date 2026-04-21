/**
 * 项目路径工具
 *
 * 将 Claude Code 的编码项目名（如 `-Users-foo-my-project`）解析为实际的
 * 文件系统工作目录（如 `/Users/foo/my-project`）。
 *
 * ## 解析策略（按优先级）
 * 1. 内存缓存命中 → 直接返回
 * 2. 项目配置中的 `originalPath` → 使用配置值
 * 3. 扫描 `~/.claude/projects/<name>/` 下的 JSONL 文件，统计 cwd 字段 → 选出最佳匹配
 * 4. 兜底：将项目名中的 `-` 替换回 `/`
 *
 * @module services/projects/utils/path-utils
 */

import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { hasInCache, setCache } from '../config/index.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/utils/path-utils');

/**
 * 将项目名中的连字符还原为路径分隔符
 *
 * Claude Code 将路径中的 `/` 编码为 `-`，此函数执行反向解码。
 *
 * @param {string} projectName - 编码后的项目名（如 `-Users-foo-project`）
 * @returns {string} 解码后的路径（如 `/Users/foo/project`）
 */
function decodeProjectName(projectName) {
  return projectName.replace(/-/g, '/');
}

/**
 * 从多个 cwd 候选中选择最佳工作目录
 *
 * 策略：若最近使用的 cwd 出现次数 >= 最大次数的 25%，则使用最近值；
 * 否则使用出现次数最多的 cwd。
 *
 * @param {Map<string, number>} cwdCounts - cwd 到出现次数的映射
 * @param {string|null} latestCwd - 最近一次使用的 cwd
 * @returns {string|null} 最佳 cwd，或 null（无候选时）
 */
function selectBestCwd(cwdCounts, latestCwd) {
  if (cwdCounts.size === 0) return null;
  // 只有一个候选时直接返回
  if (cwdCounts.size === 1) return Array.from(cwdCounts.keys())[0];

  const mostRecentCount = cwdCounts.get(latestCwd) || 0;
  const maxCount = Math.max(...cwdCounts.values());

  // 若最近 cwd 的使用频率不低于最高频率的 25%，优先使用最近值
  if (mostRecentCount >= maxCount * 0.25) return latestCwd;

  // 否则返回使用频率最高的 cwd
  for (const [cwd, count] of cwdCounts.entries()) {
    if (count === maxCount) return cwd;
  }
  return latestCwd;
}

/**
 * 处理单条 JSONL entry，更新 cwd 统计
 *
 * @param {Object} entry - 解析后的 JSONL 条目
 * @param {string} entry.cwd - 该条目记录的工作目录
 * @param {string} [entry.timestamp] - 条目时间戳
 * @param {Map} cwdCounts - cwd 计数 Map
 * @param {{latestTimestamp: number, latestCwd: string|null}} state - 状态累加器
 */
function updateCwdFromEntry(entry, cwdCounts, state) {
  if (!entry.cwd) return;
  cwdCounts.set(entry.cwd, (cwdCounts.get(entry.cwd) || 0) + 1);
  const ts = new Date(entry.timestamp || 0).getTime();
  // 追踪时间戳最新的 cwd
  if (ts > state.latestTimestamp) {
    state.latestTimestamp = ts;
    state.latestCwd = entry.cwd;
  }
}

/**
 * 扫描项目目录下的所有 JSONL 文件，统计 cwd 使用情况
 *
 * 流式读取每个 JSONL 文件，统计 cwd 字段出现频率，
 * 然后通过 selectBestCwd 选出最佳工作目录。
 *
 * @param {string[]} jsonlFiles - JSONL 文件名列表
 * @param {string} projectDir - 项目目录的绝对路径
 * @param {string} projectName - 编码后的项目名（用于兜底解码）
 * @returns {Promise<string>} 最佳 cwd 路径
 */
async function scanJsonlForCwd(jsonlFiles, projectDir, projectName) {
  const cwdCounts = new Map();
  const state = { latestTimestamp: 0, latestCwd: null };

  for (const file of jsonlFiles) {
    const jsonlFile = path.join(projectDir, file);
    const fileStream = fsSync.createReadStream(jsonlFile);
    const rl = (await import('readline')).createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        updateCwdFromEntry(JSON.parse(line), cwdCounts, state);
      } catch { /* 跳过格式错误的行 */ }
    }
  }

  return selectBestCwd(cwdCounts, state.latestCwd) || decodeProjectName(projectName);
}

/**
 * 从项目名解析出实际的文件系统目录路径
 *
 * 按优先级尝试：缓存 → 项目配置 → JSONL 扫描 → 兜底解码。
 * 结果会被缓存以避免重复扫描。
 *
 * @param {string} projectName - 编码后的项目名
 * @returns {Promise<string>} 解析出的实际目录路径
 */
async function extractProjectDirectory(projectName) {
  // 优先检查内存缓存
  if (hasInCache(projectName)) return hasInCache(projectName);

  // 尝试从项目配置中获取原始路径
  const { loadProjectConfig } = await import('../config/index.js');
  const config = await loadProjectConfig();
  if (config[projectName]?.originalPath) {
    setCache(projectName, config[projectName].originalPath);
    return config[projectName].originalPath;
  }

  // 扫描 ~/.claude/projects/<name>/ 下的 JSONL 文件
  const projectDir = path.join(os.homedir(), '.claude', 'projects', projectName);

  try {
    await fs.access(projectDir);
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    let extractedPath;
    if (jsonlFiles.length === 0) {
      // 无 JSONL 文件时直接解码项目名
      extractedPath = decodeProjectName(projectName);
    } else {
      // 扫描 JSONL 文件统计 cwd
      extractedPath = await scanJsonlForCwd(jsonlFiles, projectDir, projectName);
    }

    setCache(projectName, extractedPath);
    return extractedPath;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.error(`Error extracting project directory for ${projectName}:`, error);
    }
    // 目录不存在时回退到简单解码
    const fallback = decodeProjectName(projectName);
    setCache(projectName, fallback);
    return fallback;
  }
}

export { extractProjectDirectory };
