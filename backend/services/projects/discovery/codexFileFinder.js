/**
 * Codex File Finder
 *
 * Helper functions for finding and parsing Codex session files
 *
 * @module projects/discovery/codexFileFinder
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../../../utils/logger.js';
import { parseCodexSessionFile } from './codexSessionParser.js';

const logger = createLogger('services/projects/discovery/codexFileFinder');

/**
 * Recursively find all JSONL files in directory
 * @param {string} dir - Directory path
 * @returns {Promise<string[]>} Array of JSONL file paths
 */
export async function findJsonlFiles(dir) {
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
    // Skip unreadable directories
  }
  return files;
}

/**
 * Check if session belongs to specified project
 * @param {Object} sessionData - Session data
 * @param {string} projectPath - Project path
 * @returns {boolean}
 */
export function isSessionInProject(sessionData, projectPath) {
  const sessionCwd = sessionData?.cwd || '';

  // Handle Windows long path prefix
  const cleanSessionCwd = sessionCwd.startsWith('\\\\?\\')
    ? sessionCwd.slice(4)
    : sessionCwd;
  const cleanProjectPath = projectPath.startsWith('\\\\?\\')
    ? projectPath.slice(4)
    : projectPath;

  return sessionData.cwd === projectPath ||
    cleanSessionCwd === cleanProjectPath ||
    path.relative(cleanSessionCwd, cleanProjectPath) === '';
}

/**
 * Parse Codex session file with error handling
 * @param {string} filePath - Path to session file
 * @returns {Promise<Object|null>} Parsed session data or null
 */
export async function parseCodexSession(filePath) {
  try {
    const sessionData = await parseCodexSessionFile(filePath);
    return sessionData;
  } catch (error) {
    logger.warn(`Could not parse Codex session file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Parse all Codex session files in directory
 * @param {string} codexSessionsDir - Codex sessions directory
 * @returns {Promise<Object[]>} Array of session data
 */
export async function parseAllCodexSessions(codexSessionsDir) {
  const jsonlFiles = await findJsonlFiles(codexSessionsDir);
  const sessions = [];

  for (const filePath of jsonlFiles) {
    const sessionData = await parseCodexSession(filePath);
    if (sessionData) {
      sessions.push({ sessionData, filePath });
    }
  }

  return sessions;
}

/**
 * Filter sessions by project path
 * @param {Array} sessionsWithPaths - Array of {sessionData, filePath}
 * @param {string} projectPath - Project path to match
 * @returns {Array} Filtered sessions
 */
export function filterSessionsByProject(sessionsWithPaths, projectPath) {
  return sessionsWithPaths.filter(({ sessionData }) =>
    sessionData && isSessionInProject(sessionData, projectPath)
  );
}
