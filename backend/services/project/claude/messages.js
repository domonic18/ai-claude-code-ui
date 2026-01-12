/**
 * Claude CLI 消息处理
 *
 * 获取特定会话的消息历史
 */

import { promises as fs } from 'fs';
import fsSync from 'fs';
import readline from 'readline';
import path from 'path';
import os from 'os';

/**
 * 获取特定会话的消息（支持分页）
 * @param {string} projectName - 项目名称
 * @param {string} sessionId - 会话 ID
 * @param {number|null} limit - 消息数量限制（null 表示返回全部）
 * @param {number} offset - 分页偏移量
 * @returns {Promise<Object|Array>} 消息列表和分页信息，或全部消息
 */
async function getSessionMessages(projectName, sessionId, limit = null, offset = 0) {
  const projectDir = path.join(os.homedir(), '.claude', 'projects', projectName);

  try {
    const files = await fs.readdir(projectDir);
    // agent-*.jsonl files contain session start data at this point. This needs to be revisited
    // periodically to make sure only accurate data is there and no new functionality is added there
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl') && !file.startsWith('agent-'));

    if (jsonlFiles.length === 0) {
      return { messages: [], total: 0, hasMore: false };
    }

    const messages = [];

    // Process all JSONL files to find messages for this session
    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file);
      const fileStream = fsSync.createReadStream(jsonlFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line);
            if (entry.sessionId === sessionId) {
              messages.push(entry);
            }
          } catch (parseError) {
            console.warn('Error parsing line:', parseError.message);
          }
        }
      }
    }

    // Sort messages by timestamp
    const sortedMessages = messages.sort((a, b) =>
      new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );

    const total = sortedMessages.length;

    // If no limit is specified, return all messages (backward compatibility)
    if (limit === null) {
      return sortedMessages;
    }

    // Apply pagination - for recent messages, we need to slice from the end
    // offset 0 should give us the most recent messages
    const startIndex = Math.max(0, total - offset - limit);
    const endIndex = total - offset;
    const paginatedMessages = sortedMessages.slice(startIndex, endIndex);
    const hasMore = startIndex > 0;

    return {
      messages: paginatedMessages,
      total,
      hasMore,
      offset,
      limit
    };
  } catch (error) {
    console.error(`Error reading messages for session ${sessionId}:`, error);
    return limit === null ? [] : { messages: [], total: 0, hasMore: false };
  }
}

export {
  getSessionMessages
};
