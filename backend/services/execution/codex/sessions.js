/**
 * Codex 会话管理
 *
 * 为 OpenAI Codex CLI 的会话文件提供增删查操作。会话文件以 JSONL 格式
 * 存储在 `~/.codex/sessions/` 中，每行一个 JSON 对象，记录对话历史。
 *
 * ## 核心操作
 * - **列表**：扫描会话目录、解析文件、按项目过滤、返回最近 5 条
 * - **解析**：使用 readline 流式读取 JSONL 文件，内存高效
 * - **删除**：按会话 ID 定位并删除对应文件
 *
 * @module services/execution/codex/sessions
 */

import fsSync from 'fs';
import { promises as fs } from 'fs';
import readline from 'readline';
import path from 'path';
import os from 'os';
import { createLogger } from '../../../utils/logger.js';
import { findJsonlFiles, isSessionInProject } from './sessionFileUtils.js';
import { processEntry, buildSummary } from './codexSessionParsers.js';
import { formatSession } from './codexSessionFormatters.js';

const logger = createLogger('services/execution/codex/sessions');

/**
 * 解析单个 Codex JSONL 会话文件，提取摘要元数据
 *
 * 通过流式逐行读取避免将大文件整体加载到内存。
 * 每行为一个代表对话条目的 JSON 对象。
 * 解析器累积元数据（会话 ID、时间戳、最后消息、消息计数）。
 *
 * @param {string} filePath - `.jsonl` 会话文件的绝对路径
 * @returns {Promise<Object|null>} 会话摘要对象；解析失败或无有效元数据时返回 null
 */
async function parseCodexSessionFile(filePath) {
  try {
    const fileStream = fsSync.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    // 由 processEntry 对每行 JSONL 更新的累加器状态
    const state = { sessionMeta: null, lastTimestamp: null, lastUserMessage: null, messageCount: 0 };

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        processEntry(JSON.parse(line), state);
      } catch { /* 跳过格式错误的行 */ }
    }

    // 仅在找到会话元数据（第一个有效条目）时返回摘要
    return state.sessionMeta
      ? buildSummary(state.sessionMeta, state.lastTimestamp, state.lastUserMessage, state.messageCount)
      : null;
  } catch (error) {
    logger.error('Error parsing Codex session file:', error);
    return null;
  }
}

/**
 * 获取指定项目的最近 Codex 会话列表
 *
 * 扫描 `~/.codex/sessions/` 中的 JSONL 文件，逐个解析，按项目路径过滤，
 * 返回按最后活跃时间倒序排列的前 5 条记录。
 *
 * @param {string} projectPath - 要过滤会话的项目绝对路径
 * @returns {Promise<Array<Object>>} 格式化后的会话对象数组（最多 5 条），
 *          按最后活跃时间倒序排列
 */
async function getCodexSessions(projectPath) {
  try {
    const codexSessionsDir = path.join(os.homedir(), '.codex', 'sessions');
    // 会话目录不存在时静默返回空数组
    try { await fs.access(codexSessionsDir); } catch { return []; }

    const jsonlFiles = await findJsonlFiles(codexSessionsDir);
    const sessions = [];

    for (const filePath of jsonlFiles) {
      try {
        const sessionData = await parseCodexSessionFile(filePath);
        // 仅包含属于当前请求项目的会话
        if (sessionData && isSessionInProject(sessionData, projectPath)) {
          sessions.push(formatSession(sessionData, filePath));
        }
      } catch (error) {
        logger.warn({ err: error, filePath }, 'Could not parse Codex session file');
      }
    }

    // 返回最近 5 条会话
    sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    return sessions.slice(0, 5);
  } catch (error) {
    logger.error('Error fetching Codex sessions:', error);
    return [];
  }
}

/**
 * 根据会话 ID 删除 Codex 会话
 *
 * 扫描会话目录中的所有 JSONL 文件，找到匹配给定会话 ID 的文件后删除。
 * 时间复杂度 O(n)（n 为会话文件数量），在典型目录规模下可接受。
 *
 * @param {string} sessionId - 要删除的会话唯一标识符
 * @returns {Promise<boolean>} 找到并删除成功返回 true
 * @throws {Error} 未找到会话文件或删除失败时抛出
 */
async function deleteCodexSession(sessionId) {
  try {
    const codexSessionsDir = path.join(os.homedir(), '.codex', 'sessions');
    const jsonlFiles = await findJsonlFiles(codexSessionsDir);

    for (const filePath of jsonlFiles) {
      const sessionData = await parseCodexSessionFile(filePath);
      if (sessionData && sessionData.id === sessionId) {
        await fs.unlink(filePath);
        return true;
      }
    }
    throw new Error(`Codex session file not found for session ${sessionId}`);
  } catch (error) {
    logger.error(`Error deleting Codex session ${sessionId}:`, error);
    throw error;
  }
}

export { parseCodexSessionFile, getCodexSessions, deleteCodexSession };
