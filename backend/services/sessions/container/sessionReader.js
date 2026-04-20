/**
 * Session Reader
 *
 * Reads and parses session data from container files
 * Extracted from ContainerSessions.js to reduce complexity.
 *
 * @module sessions/container/sessionReader
 */

import { createLogger } from '../../../utils/logger.js';
import { encodeProjectName } from './containerPathEncoder.js';
import { readFileFromContainer, execAndCollectOutput } from './containerFileReader.js';
import { CONTAINER } from '../../../config/config.js';

const logger = createLogger('services/sessions/container/sessionReader');

/**
 * Parse JSONL lines into entries
 * @param {string} content - JSONL content
 * @returns {Array} Parsed entries
 */
export function parseJsonlLines(content) {
  const lines = content.split('\n');
  const entries = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Preserve unparseable lines
      entries.push({ _raw: line });
    }
  }

  return entries;
}

/**
 * Iterate over session files and execute handler
 * @param {number} userId - User ID
 * @param {string} projectDir - Project directory in container
 * @param {string[]} sessionFiles - Session file names
 * @param {function} handler - File handler function
 * @returns {Promise<void>}
 */
export async function forEachSessionFile(userId, projectDir, sessionFiles, handler) {
  for (const fileName of sessionFiles) {
    try {
      const filePath = `${projectDir}/${fileName}`;
      const content = await readFileFromContainer(userId, filePath);
      const entries = parseJsonlLines(content);

      const shouldStop = await handler({ filePath, entries });
      if (shouldStop) return;
    } catch (error) {
      logger.warn(`[SessionReader] Failed to process session file ${fileName}:`, error.message);
    }
  }
}

/**
 * List session files in project directory
 * @param {number} userId - User ID
 * @param {string} projectName - Project name
 * @returns {Promise<string[]>} Session file names
 */
export async function listSessionFiles(userId, projectName) {
  const encodedProjectName = encodeProjectName(projectName);
  const projectDir = `${CONTAINER.paths.projects}/${encodedProjectName}`;

  const output = await execAndCollectOutput(
    userId,
    ['sh', '-c', 'for f in "$1"/*.jsonl; do [ -f "$f" ] && basename "$f"; done 2>/dev/null || echo ""', 'listJsonl', projectDir],
    { silentStderr: true }
  );

  try {
    const files = output.trim().split('\n').filter(f => f.trim());
    // Filter out agent-*.jsonl files
    return files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));
  } catch (e) {
    return [];
  }
}

/**
 * Get project directory path
 * @param {string} projectName - Project name
 * @returns {string} Project directory path
 */
export function getProjectDir(projectName) {
  const encodedProjectName = encodeProjectName(projectName);
  return `${CONTAINER.paths.projects}/${encodedProjectName}`;
}

/**
 * Collect all session data
 * @param {number} userId - User ID
 * @param {string} projectDir - Project directory
 * @param {string[]} sessionFiles - Session file names
 * @returns {Promise<{allSessions: Map, allEntries: Array}>}
 */
export async function collectAllSessionData(userId, projectDir, sessionFiles) {
  const { parseJsonlContent } = await import('../../core/utils/jsonl-parser.js');
  const allSessions = new Map();
  const allEntries = [];

  await forEachSessionFile(userId, projectDir, sessionFiles, ({ entries }) => {
    const result = parseJsonlContent(
      entries.map(e => e._raw || JSON.stringify(e)).filter(l => l.trim()).join('\n')
    );

    result.sessions.forEach(session => {
      if (!allSessions.has(session.id)) {
        allSessions.set(session.id, session);
      }
    });

    allEntries.push(...result.entries);
  });

  return { allSessions, allEntries };
}

/**
 * Collect messages for specific session
 * @param {number} userId - User ID
 * @param {string} projectDir - Project directory
 * @param {string[]} sessionFiles - Session file names
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} Messages array
 */
export async function collectMessagesForSession(userId, projectDir, sessionFiles, sessionId) {
  const messages = [];

  await forEachSessionFile(userId, projectDir, sessionFiles, ({ entries }) => {
    for (const entry of entries) {
      if (entry.sessionId === sessionId && !entry._raw) {
        messages.push(entry);
      }
    }
  });

  return messages;
}

/**
 * Get session files info (for debugging)
 * @param {number} userId - User ID
 * @param {string} projectName - Project name
 * @returns {Promise<string>} Output from ls command
 */
export async function getSessionFilesInfo(userId, projectName) {
  const projectDir = getProjectDir(projectName);

  const output = await execAndCollectOutput(
    userId,
    ['sh', '-c', 'ls -la "$1" 2>/dev/null || echo "Directory not found"', 'lsDir', projectDir],
    { logLabel: 'SessionReader' }
  );

  return output;
}
