/**
 * Codex 消息处理
 *
 * 获取特定 Codex 会话的消息历史
 */

import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createLogger } from '../../../utils/logger.js';
import { parseJsonlMessages, applyPagination } from './codexMessageParsing.js';

const logger = createLogger('services/execution/codex/messages');

// ─── 辅助函数 ────────────────────────────────────────────

/**
 * 递归查找包含指定 sessionId 的 .jsonl 文件
 * @param {string} dir - 搜索起始目录
 * @param {string} sessionId - 目标会话 ID
 * @returns {Promise<string|null>} 文件路径，未找到返回 null
 */
async function findSessionFile(dir, sessionId) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await findSessionFile(fullPath, sessionId);
        if (found) return found;
      } else if (entry.name.includes(sessionId) && entry.name.endsWith('.jsonl')) {
        return fullPath;
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return null;
}

// ─── 主函数 ────────────────────────────────────────────

/**
 * 获取特定 Codex 会话的消息（支持分页）
 * @param {string} sessionId - 会话 ID
 * @param {number|null} limit - 消息数量限制（null 表示返回全部）
 * @param {number} offset - 分页偏移量
 * @returns {Promise<Object>} 消息列表和分页信息
 */
async function getCodexSessionMessages(sessionId, limit = null, offset = 0) {
  try {
    const codexSessionsDir = path.join(os.homedir(), '.codex', 'sessions');

    // 步骤 1：查找会话文件
    const sessionFilePath = await findSessionFile(codexSessionsDir, sessionId);

    if (!sessionFilePath) {
      logger.warn(`Codex session file not found for session ${sessionId}`);
      return { messages: [], total: 0, hasMore: false };
    }

    // 步骤 2：解析 JSONL 文件
    const { messages, tokenUsage } = await parseJsonlMessages(sessionFilePath);

    // 步骤 3：应用分页
    return applyPagination(messages, messages.length, limit, offset, tokenUsage);

  } catch (error) {
    logger.error(`Error reading Codex session messages for ${sessionId}:`, error);
    return { messages: [], total: 0, hasMore: false };
  }
}

export {
  getCodexSessionMessages
};
