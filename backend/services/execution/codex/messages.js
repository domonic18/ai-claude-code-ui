/**
 * Codex 消息处理
 *
 * 获取特定 Codex 会话的消息历史
 */

import fsSync from 'fs';
import readline from 'readline';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createLogger } from '../../../utils/logger.js';
import { PAYLOAD_HANDLERS } from './payloadHandlers.js';
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

/**
 * 处理 token_count 事件并提取 token 使用信息
 * @param {object} payloadInfo - payload.info 对象
 * @returns {object|null} token 使用信息对象
 */
function extractTokenUsage(payloadInfo) {
  if (!payloadInfo?.total_token_usage) return null;

  return {
    used: payloadInfo.total_token_usage.total_tokens || 0,
    total: payloadInfo.model_context_window || 200000
  };
}

/**
 * 检查是否为 token_count 事件
 * @param {object} entry - JSONL 条目
 * @returns {boolean}
 */
function isTokenCountEvent(entry) {
  return entry.type === 'event_msg' &&
         entry.payload?.type === 'token_count' &&
         entry.payload?.info;
}

/**
 * 检查是否为 response_item 条目
 * @param {object} entry - JSONL 条目
 * @returns {boolean}
 */
function isResponseItem(entry) {
  return entry.type === 'response_item' && entry.payload?.type;
}

/**
 * 处理单行 JSONL 数据
 * @param {string} line - JSONL 行
 * @param {Array} messages - 消息数组（用于累积结果）
 * @param {object} currentTokenUsage - 当前 token 使用信息
 * @returns {boolean} 是否成功处理
 */
function processJsonlLine(line, messages, currentTokenUsage) {
  if (!line.trim()) return false;

  try {
    const entry = JSON.parse(line);

    // Extract token usage from token_count events (keep latest)
    if (isTokenCountEvent(entry)) {
      const usage = extractTokenUsage(entry.payload.info);
      if (usage) Object.assign(currentTokenUsage, usage);
      return true;
    }

    // Dispatch response_item entries to handlers
    if (isResponseItem(entry)) {
      const handler = PAYLOAD_HANDLERS.get(entry.payload.type);
      const result = handler?.(entry);
      if (result) messages.push(result);
    }

    return true;
  } catch {
    // Skip malformed lines
    return false;
  }
}

/**
 * 从 JSONL 文件逐行解析消息和 token 使用信息
 * @param {string} filePath - JSONL 文件路径
 * @returns {Promise<{messages: Array, tokenUsage: Object|null}>}
 */
async function parseJsonlMessages(filePath) {
  const messages = [];
  const tokenUsage = {};

  const fileStream = fsSync.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    processJsonlLine(line, messages, tokenUsage);
  }

  // Sort by timestamp
  messages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  // Return tokenUsage only if it has values
  const finalTokenUsage = Object.keys(tokenUsage).length > 0 ? tokenUsage : null;

  return { messages, tokenUsage: finalTokenUsage };
}

/**
 * 对消息列表应用分页
 * @param {Array} messages - 已排序的消息列表
 * @param {number} total - 总消息数
 * @param {number|null} limit - 消息数量限制（null 表示返回全部）
 * @param {number} offset - 分页偏移量
 * @param {Object|null} tokenUsage - token 使用信息
 * @returns {Object} 分页结果
 */
function applyPagination(messages, total, limit, offset, tokenUsage) {
  if (limit === null) {
    return { messages, tokenUsage };
  }

  const startIndex = Math.max(0, total - offset - limit);
  const endIndex = total - offset;
  return {
    messages: messages.slice(startIndex, endIndex),
    total,
    hasMore: startIndex > 0,
    offset,
    limit,
    tokenUsage
  };
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
