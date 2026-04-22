/**
 * codexSessionParser.js
 *
 * Codex 会话文件解析器 — 从 CodexDiscovery.js 提取
 *
 * @module projects/discovery/codexSessionParser
 */

import fsSync from 'fs';
import readline from 'readline';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/projects/discovery/codexSessionParser');

// 在解析 JSONL 文件时逐行调用，提取并更新会话元数据状态
/**
 * 处理单条 JSONL entry，更新解析状态
 * @param {Object} entry - 解析后的 JSON entry
 * @param {Object} state - 可变的解析状态 { sessionMeta, lastTimestamp, lastUserMessage, messageCount }
 */
function processEntry(entry, state) {
  if (entry.timestamp) {
    state.lastTimestamp = entry.timestamp;
  }

  if (entry.type === 'session_meta' && entry.payload) {
    state.sessionMeta = {
      id: entry.payload.id,
      cwd: entry.payload.cwd,
      model: entry.payload.model || entry.payload.model_provider,
      timestamp: entry.timestamp,
      git: entry.payload.git
    };
  }

  if (entry.type === 'event_msg' && entry.payload?.type === 'user_message') {
    state.messageCount++;
    if (entry.payload.message) {
      state.lastUserMessage = entry.payload.message;
    }
  }

  if (entry.type === 'response_item' && entry.payload?.type === 'message' && entry.payload.role === 'assistant') {
    state.messageCount++;
  }
}

// 在生成会话摘要时调用，确保文本不超过前端展示的最大长度
/**
 * 截断摘要文本到指定最大长度
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
function truncateSummary(text, maxLength = 50) {
  if (!text) return 'Codex Session';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// 在扫描 Codex 项目时调用，读取并解析 .codex/ 文件夹中的会话 JSONL 文件
/**
 * 解析 Codex 会话 JSONL 文件以提取元数据
 * @param {string} filePath - JSONL 文件路径
 * @returns {Promise<Object|null>} 会话元数据
 */
export async function parseCodexSessionFile(filePath) {
  try {
    const fileStream = fsSync.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const state = { sessionMeta: null, lastTimestamp: null, lastUserMessage: null, messageCount: 0 };

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        processEntry(entry, state);
      } catch (_parseError) {
        // Skip malformed lines
      }
    }

    if (!state.sessionMeta) return null;

    return {
      ...state.sessionMeta,
      timestamp: state.lastTimestamp || state.sessionMeta.timestamp,
      summary: truncateSummary(state.lastUserMessage),
      messageCount: state.messageCount
    };

  } catch (error) {
    logger.error('Error parsing Codex session file:', error);
    return null;
  }
}
