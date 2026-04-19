import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { hasInCache, setCache } from '../config/index.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/utils/path-utils');

function decodeProjectName(projectName) {
  return projectName.replace(/-/g, '/');
}

function selectBestCwd(cwdCounts, latestCwd) {
  if (cwdCounts.size === 0) return null;
  if (cwdCounts.size === 1) return Array.from(cwdCounts.keys())[0];

  const mostRecentCount = cwdCounts.get(latestCwd) || 0;
  const maxCount = Math.max(...cwdCounts.values());

  if (mostRecentCount >= maxCount * 0.25) return latestCwd;

  for (const [cwd, count] of cwdCounts.entries()) {
    if (count === maxCount) return cwd;
  }
  return latestCwd;
}

/**
 * 处理单条 JSONL entry，更新 cwd 统计
 * @param {Object} entry - 解析后的 entry
 * @param {Map} cwdCounts - cwd 计数 Map
 * @param {{latestTimestamp: number, latestCwd: string|null}} state - 状态
 */
function updateCwdFromEntry(entry, cwdCounts, state) {
  if (!entry.cwd) return;
  cwdCounts.set(entry.cwd, (cwdCounts.get(entry.cwd) || 0) + 1);
  const ts = new Date(entry.timestamp || 0).getTime();
  if (ts > state.latestTimestamp) {
    state.latestTimestamp = ts;
    state.latestCwd = entry.cwd;
  }
}

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
      } catch { /* skip malformed */ }
    }
  }

  return selectBestCwd(cwdCounts, state.latestCwd) || decodeProjectName(projectName);
}

async function extractProjectDirectory(projectName) {
  if (hasInCache(projectName)) return hasInCache(projectName);

  const { loadProjectConfig } = await import('../config/index.js');
  const config = await loadProjectConfig();
  if (config[projectName]?.originalPath) {
    setCache(projectName, config[projectName].originalPath);
    return config[projectName].originalPath;
  }

  const projectDir = path.join(os.homedir(), '.claude', 'projects', projectName);

  try {
    await fs.access(projectDir);
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    let extractedPath;
    if (jsonlFiles.length === 0) {
      extractedPath = decodeProjectName(projectName);
    } else {
      extractedPath = await scanJsonlForCwd(jsonlFiles, projectDir, projectName);
    }

    setCache(projectName, extractedPath);
    return extractedPath;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.error(`Error extracting project directory for ${projectName}:`, error);
    }
    const fallback = decodeProjectName(projectName);
    setCache(projectName, fallback);
    return fallback;
  }
}

export { extractProjectDirectory };
