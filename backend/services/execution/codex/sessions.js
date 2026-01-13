/**
 * Codex 会话解析
 *
 * 解析 Codex 的 JSONL 会话文件，提取会话元数据
 */

import fsSync from 'fs';
import { promises as fs } from 'fs';
import readline from 'readline';
import path from 'path';
import os from 'os';

/**
 * 解析 Codex 会话 JSONL 文件以提取元数据
 * @param {string} filePath - JSONL 文件路径
 * @returns {Promise<Object|null>} 会话元数据
 */
async function parseCodexSessionFile(filePath) {
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

          // Track timestamp
          if (entry.timestamp) {
            lastTimestamp = entry.timestamp;
          }

          // Extract session metadata
          if (entry.type === 'session_meta' && entry.payload) {
            sessionMeta = {
              id: entry.payload.id,
              cwd: entry.payload.cwd,
              model: entry.payload.model || entry.payload.model_provider,
              timestamp: entry.timestamp,
              git: entry.payload.git
            };
          }

          // Count messages and extract user messages for summary
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
        summary: lastUserMessage ?
          (lastUserMessage.length > 50 ? lastUserMessage.substring(0, 50) + '...' : lastUserMessage) :
          'Codex Session',
        messageCount
      };
    }

    return null;

  } catch (error) {
    console.error('Error parsing Codex session file:', error);
    return null;
  }
}

/**
 * 获取项目的 Codex 会话列表
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Array>} Codex 会话列表
 */
async function getCodexSessions(projectPath) {
  try {
    const codexSessionsDir = path.join(os.homedir(), '.codex', 'sessions');
    const sessions = [];

    // Check if the directory exists
    try {
      await fs.access(codexSessionsDir);
    } catch (error) {
      // No Codex sessions directory
      return [];
    }

    // Recursively find all .jsonl files in the sessions directory
    const findJsonlFiles = async (dir) => {
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
        // Skip directories we can't read
      }
      return files;
    };

    const jsonlFiles = await findJsonlFiles(codexSessionsDir);

    // Process each file to find sessions matching the project path
    for (const filePath of jsonlFiles) {
      try {
        const sessionData = await parseCodexSessionFile(filePath);

        // Check if this session matches the project path
        // Handle Windows long paths with \\?\ prefix
        const sessionCwd = sessionData?.cwd || '';
        const cleanSessionCwd = sessionCwd.startsWith('\\\\?\\') ? sessionCwd.slice(4) : sessionCwd;
        const cleanProjectPath = projectPath.startsWith('\\\\?\\') ? projectPath.slice(4) : projectPath;

        if (sessionData && (sessionData.cwd === projectPath || cleanSessionCwd === cleanProjectPath || path.relative(cleanSessionCwd, cleanProjectPath) === '')) {
          sessions.push({
            id: sessionData.id,
            summary: sessionData.summary || 'Codex Session',
            messageCount: sessionData.messageCount || 0,
            lastActivity: sessionData.timestamp ? new Date(sessionData.timestamp) : new Date(),
            cwd: sessionData.cwd,
            model: sessionData.model,
            filePath: filePath,
            provider: 'codex'
          });
        }
      } catch (error) {
        console.warn(`Could not parse Codex session file ${filePath}:`, error.message);
      }
    }

    // Sort sessions by last activity (newest first)
    sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    // Return only the first 5 sessions for performance
    return sessions.slice(0, 5);

  } catch (error) {
    console.error('Error fetching Codex sessions:', error);
    return [];
  }
}

/**
 * 删除 Codex 会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteCodexSession(sessionId) {
  try {
    const codexSessionsDir = path.join(os.homedir(), '.codex', 'sessions');

    const findJsonlFiles = async (dir) => {
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
      } catch (error) {}
      return files;
    };

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
    console.error(`Error deleting Codex session ${sessionId}:`, error);
    throw error;
  }
}

export {
  parseCodexSessionFile,
  getCodexSessions,
  deleteCodexSession
};
