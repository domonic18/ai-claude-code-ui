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

    let sessionMeta = null;
    let lastTimestamp = null;
    let lastUserMessage = null;
    let messageCount = 0;

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);

          if (entry.timestamp) {
            lastTimestamp = entry.timestamp;
          }

          if (entry.type === 'session_meta' && entry.payload) {
            sessionMeta = {
              id: entry.payload.id,
              cwd: entry.payload.cwd,
              model: entry.payload.model || entry.payload.model_provider,
              timestamp: entry.timestamp,
              git: entry.payload.git
            };
          }

          if (entry.type === 'event_msg' && entry.payload?.type === 'user_message') {
            messageCount++;
            if (entry.payload.message) {
              lastUserMessage = entry.payload.message;
            }
          }

          if (entry.type === 'response_item' && entry.payload?.type === 'message' && entry.payload.role === 'assistant') {
            messageCount++;
          }

        } catch (parseError) {
          // Skip malformed lines
        }
      }
    }

    if (sessionMeta) {
      return {
        ...sessionMeta,
        timestamp: lastTimestamp || sessionMeta.timestamp,
        summary: lastUserMessage
          ? (lastUserMessage.length > 50 ? lastUserMessage.substring(0, 50) + '...' : lastUserMessage)
          : 'Codex Session',
        messageCount
      };
    }

    return null;

  } catch (error) {
    logger.error('Error parsing Codex session file:', error);
    return null;
  }
}
