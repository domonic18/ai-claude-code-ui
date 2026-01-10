/**
 * Session Management Routes
 *
 * Handles session-related API endpoints for managing
 * chat sessions, messages, and token usage.
 *
 * Routes:
 * - GET /api/projects/:projectName/sessions - List project sessions
 * - GET /api/projects/:projectName/sessions/:sessionId/messages - Get session messages
 * - DELETE /api/projects/:projectName/sessions/:sessionId - Delete session
 * - GET /api/projects/:projectName/sessions/:sessionId/token-usage - Get token usage
 */

import express from 'express';
import path from 'path';
import { promises as fsPromises } from 'fs';
import os from 'os';

import { getSessions, getSessionMessages, deleteSession } from '../services/project/index.js';

const router = express.Router();

/**
 * GET /api/projects/:projectName/sessions
 * Get list of sessions for a project
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
 * Get messages for a specific session
 */
router.get('/:projectName/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    const { limit, offset } = req.query;

    // Parse limit and offset if provided
    const parsedLimit = limit ? parseInt(limit, 10) : null;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const result = await getSessionMessages(projectName, sessionId, parsedLimit, parsedOffset);

    // Handle both old and new response formats
    if (Array.isArray(result)) {
      // Backward compatibility: no pagination parameters were provided
      res.json({ messages: result });
    } else {
      // New format with pagination info
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/projects/:projectName/sessions/:sessionId
 * Delete a specific session
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
 * Get token usage for a specific session
 */
router.get('/:projectName/sessions/:sessionId/token-usage', async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    const { provider = 'claude' } = req.query;
    const homeDir = os.homedir();

    // Allow only safe characters in sessionId
    const safeSessionId = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeSessionId) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    // Handle Cursor sessions - they use SQLite and don't have token usage info
    if (provider === 'cursor') {
      return res.json({
        used: 0,
        total: 0,
        breakdown: { input: 0, cacheCreation: 0, cacheRead: 0 },
        unsupported: true,
        message: 'Token usage tracking not available for Cursor sessions'
      });
    }

    // Handle Codex sessions
    if (provider === 'codex') {
      const codexSessionsDir = path.join(homeDir, '.codex', 'sessions');

      // Find the session file by searching for the session ID
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
          // Skip directories we can't read
        }
        return null;
      };

      const sessionFilePath = await findSessionFile(codexSessionsDir);

      if (!sessionFilePath) {
        return res.status(404).json({ error: 'Codex session file not found', sessionId: safeSessionId });
      }

      // Read session file to count tokens
      const sessionContent = await fsPromises.readFile(sessionFilePath, 'utf8');
      const lines = sessionContent.split('\n').filter(line => line.trim());
      const messageCount = lines.length;

      // Rough estimation: average 100 tokens per message
      const estimatedTokens = messageCount * 100;

      return res.json({
        used: estimatedTokens,
        total: 200000, // Default Codex limit
        breakdown: { input: estimatedTokens, cacheCreation: 0, cacheRead: 0 },
        estimated: true
      });
    }

    // Handle Claude sessions
    const claudeProjectsPath = path.join(homeDir, '.claude', 'projects');
    const projectPath = projectName.replace(/-/g, '/');

    try {
      // Try to find the session file
      const sessionsDir = path.join(claudeProjectsPath, projectPath, 'sessions');
      const sessionFilePath = path.join(sessionsDir, `${safeSessionId}.jsonl`);

      await fsPromises.access(sessionFilePath);

      // Read the session file
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
          // Skip malformed lines
        }
      }

      totalTokens += inputTokens + cacheCreationTokens + cacheReadTokens;

      res.json({
        used: totalTokens,
        total: 200000, // Default Claude limit
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
