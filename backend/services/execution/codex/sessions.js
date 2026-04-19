import fsSync from 'fs';
import { promises as fs } from 'fs';
import readline from 'readline';
import path from 'path';
import os from 'os';
import { createLogger } from '../../../utils/logger.js';
import { findJsonlFiles, isSessionInProject } from './sessionFileUtils.js';
const logger = createLogger('services/execution/codex/sessions');

function processEntry(entry, state) {
  if (entry.timestamp) state.lastTimestamp = entry.timestamp;

  if (entry.type === 'session_meta' && entry.payload) {
    state.sessionMeta = {
      id: entry.payload.id,
      cwd: entry.payload.cwd,
      model: entry.payload.model || entry.payload.model_provider,
      timestamp: entry.timestamp,
      git: entry.payload.git,
    };
  }

  if (entry.type === 'event_msg' && entry.payload?.type === 'user_message') {
    state.messageCount++;
    if (entry.payload.message) state.lastUserMessage = entry.payload.message;
  }

  if (entry.type === 'response_item' && entry.payload?.type === 'message' && entry.payload.role === 'assistant') {
    state.messageCount++;
  }
}

function buildSummary(sessionMeta, lastTimestamp, lastUserMessage, messageCount) {
  return {
    ...sessionMeta,
    timestamp: lastTimestamp || sessionMeta.timestamp,
    summary: lastUserMessage
      ? (lastUserMessage.length > 50 ? lastUserMessage.substring(0, 50) + '...' : lastUserMessage)
      : 'Codex Session',
    messageCount,
  };
}

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
          sessions.push({
            id: sessionData.id,
            summary: sessionData.summary || 'Codex Session',
            messageCount: sessionData.messageCount || 0,
            lastActivity: sessionData.timestamp ? new Date(sessionData.timestamp) : new Date(),
            cwd: sessionData.cwd,
            model: sessionData.model,
            filePath,
            provider: 'codex',
          });
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
