/**
 * 会话管理路由
 *
 * 处理会话相关的 API 端点，用于管理
 * 聊天会话、消息和令牌使用情况。
 *
 * 路由：
 * - GET /api/projects/:projectName/sessions - 列出项目会话
 * - GET /api/projects/:projectName/sessions/:sessionId/messages - 获取会话消息
 * - DELETE /api/projects/:projectName/sessions/:sessionId - 删除会话
 * - GET /api/projects/:projectName/sessions/:sessionId/token-usage - 获取令牌使用情况
 */

import express from 'express';
import path from 'path';
import { promises as fsPromises } from 'fs';
import os from 'os';

import { getSessions, getSessionMessages, deleteSession } from '../services/project/index.js';

const router = express.Router();

/**
 * GET /api/projects/:projectName/sessions
 * 获取项目的会话列表
 */
router.get('/:projectName/sessions', async (req, res) => {
  try {
    const { limit = 5, offset = 0 } = req.query;
    const result = await getSessions(req.params.projectName, parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectName/sessions/:sessionId/messages
 * 获取特定会话的消息
 */
router.get('/:projectName/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    const { limit, offset } = req.query;

    // 如果提供了限制和偏移量，则解析它们
    const parsedLimit = limit ? parseInt(limit, 10) : null;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const result = await getSessionMessages(projectName, sessionId, parsedLimit, parsedOffset);

    // 处理旧和新两种响应格式
    if (Array.isArray(result)) {
      // 向后兼容：未提供分页参数
      res.json({ messages: result });
    } else {
      // 带分页信息的新格式
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projects/:projectName/sessions/:sessionId
 * 删除特定会话
 */
router.delete('/:projectName/sessions/:sessionId', async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    console.log(`[API] Deleting session: ${sessionId} from project: ${projectName}`);
    await deleteSession(projectName, sessionId);
    console.log(`[API] Session ${sessionId} deleted successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[API] Error deleting session ${req.params.sessionId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/projects/:projectName/sessions/:sessionId/token-usage
 * 获取特定会话的令牌使用情况
 */
router.get('/:projectName/sessions/:sessionId/token-usage', async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    const { provider = 'claude' } = req.query;
    const homeDir = os.homedir();

    // 只允许 sessionId 中包含安全字符
    const safeSessionId = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeSessionId) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    // 处理 Cursor 会话 - 它们使用 SQLite，没有令牌使用信息
    if (provider === 'cursor') {
      return res.json({
        used: 0,
        total: 0,
        breakdown: { input: 0, cacheCreation: 0, cacheRead: 0 },
        unsupported: true,
        message: 'Token usage tracking not available for Cursor sessions'
      });
    }

    // 处理 Codex 会话
    if (provider === 'codex') {
      const codexSessionsDir = path.join(homeDir, '.codex', 'sessions');

      // 通过搜索会话 ID 来查找会话文件
      const findSessionFile = async (dir) => {
        try {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const found = await findSessionFile(fullPath);
              if (found) return found;
            } else if (entry.name.includes(safeSessionId) && entry.name.endsWith('.jsonl')) {
              return fullPath;
            }
          }
        } catch (error) {
          // 跳过我们无法读取的目录
        }
        return null;
      };

      const sessionFilePath = await findSessionFile(codexSessionsDir);

      if (!sessionFilePath) {
        return res.status(404).json({ error: 'Codex session file not found', sessionId: safeSessionId });
      }

      // 读取会话文件以计算令牌
      const sessionContent = await fsPromises.readFile(sessionFilePath, 'utf8');
      const lines = sessionContent.split('\n').filter(line => line.trim());
      const messageCount = lines.length;

      // 粗略估算：平均每条消息 100 个令牌
      const estimatedTokens = messageCount * 100;

      return res.json({
        used: estimatedTokens,
        total: 200000, // Codex 默认限制
        breakdown: { input: estimatedTokens, cacheCreation: 0, cacheRead: 0 },
        estimated: true
      });
    }

    // 处理 Claude 会话
    const claudeProjectsPath = path.join(homeDir, '.claude', 'projects');
    const projectPath = projectName.replace(/-/g, '/');

    try {
      // 尝试查找会话文件
      const sessionsDir = path.join(claudeProjectsPath, projectPath, 'sessions');
      const sessionFilePath = path.join(sessionsDir, `${safeSessionId}.jsonl`);

      await fsPromises.access(sessionFilePath);

      // 读取会话文件
      const sessionContent = await fsPromises.readFile(sessionFilePath, 'utf8');
      const lines = sessionContent.split('\n').filter(line => line.trim());

      let totalTokens = 0;
      let inputTokens = 0;
      let cacheCreationTokens = 0;
      let cacheReadTokens = 0;

      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.usage) {
            const usage = message.usage;
            if (usage.input_tokens) inputTokens += usage.input_tokens;
            if (usage.cache_creation_input_tokens) cacheCreationTokens += usage.cache_creation_input_tokens;
            if (usage.cache_read_input_tokens) cacheReadTokens += usage.cache_read_input_tokens;
            if (usage.output_tokens) totalTokens += usage.output_tokens;
          }
        } catch (parseError) {
          // 跳过格式错误的行
        }
      }

      totalTokens += inputTokens + cacheCreationTokens + cacheReadTokens;

      res.json({
        used: totalTokens,
        total: 200000, // Claude 默认限制
        breakdown: {
          input: inputTokens,
          cacheCreation: cacheCreationTokens,
          cacheRead: cacheReadTokens
        }
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Session file not found', sessionId: safeSessionId });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
