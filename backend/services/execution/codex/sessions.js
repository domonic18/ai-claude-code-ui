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

async function parseCodexSessionFile(filePath) {
  try {
    const fileStream = fsSync.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const state = { sessionMeta: null, lastTimestamp: null, lastUserMessage: null, messageCount: 0 };

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        processEntry(JSON.parse(line), state);
      } catch { /* skip malformed lines */ }
    }

    return state.sessionMeta
      ? buildSummary(state.sessionMeta, state.lastTimestamp, state.lastUserMessage, state.messageCount)
      : null;
  } catch (error) {
    logger.error('Error parsing Codex session file:', error);
    return null;
  }
}

async function getCodexSessions(projectPath) {
  try {
    const codexSessionsDir = path.join(os.homedir(), '.codex', 'sessions');
    try { await fs.access(codexSessionsDir); } catch { return []; }

    const jsonlFiles = await findJsonlFiles(codexSessionsDir);
    const sessions = [];

    for (const filePath of jsonlFiles) {
      try {
        const sessionData = await parseCodexSessionFile(filePath);
        if (sessionData && isSessionInProject(sessionData, projectPath)) {
          sessions.push(formatSession(sessionData, filePath));
        }
      } catch (error) {
        logger.warn(`Could not parse Codex session file ${filePath}:`, error.message);
      }
    }

    sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    return sessions.slice(0, 5);
  } catch (error) {
    logger.error('Error fetching Codex sessions:', error);
    return [];
  }
}

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
