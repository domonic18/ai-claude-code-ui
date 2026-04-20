/**
 * Session Adapter I/O Operations
 *
 * Input/output utilities for session adapter operations
 *
 * @module container/adapters/sessionAdapterIo
 */

import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('services/container/adapters/SessionAdapterIo');

/**
 * Reads command output from stream
 * @param {Object} stream - Command output stream
 * @returns {Promise<string>} Output string
 */
export function readCommandOutput(stream) {
  return new Promise((resolve, reject) => {
    let output = '';

    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    stream.on('error', (err) => {
      reject(err);
    });

    stream.on('end', () => {
      resolve(output);
    });
  });
}

/**
 * Finds all JSONL session files in a directory
 * @param {Object} containerManager - Container manager instance
 * @param {number} userId - User ID
 * @param {string} sessionsDir - Sessions directory path
 * @returns {Promise<Array<string>>} List of JSONL file paths
 */
export async function findJsonlSessionFiles(containerManager, userId, sessionsDir) {
  const { stream } = await containerManager.execInContainer(
    userId,
    `find "${sessionsDir}" -name "*.jsonl" -type f 2>/dev/null || true`
  );

  const output = await readCommandOutput(stream);
  return output.trim().split('\n').filter(Boolean);
}

/**
 * Parses a single session file
 * @param {Object} containerManager - Container manager instance
 * @param {number} userId - User ID
 * @param {string} filePath - File path
 * @param {Object} jsonlParser - JSONL parser instance
 * @returns {Promise<Array>} Parsed sessions
 */
export async function parseSessionFile(containerManager, userId, filePath, jsonlParser) {
  const { stream } = await containerManager.execInContainer(userId, `cat "${filePath}"`);
  const content = await readCommandOutput(stream);
  return jsonlParser.parseSessions(content);
}

/**
 * Parses messages from a session file for a specific session
 * @param {Object} containerManager - Container manager instance
 * @param {number} userId - User ID
 * @param {string} filePath - File path
 * @param {string} sessionId - Session ID
 * @param {Object} jsonlParser - JSONL parser instance
 * @returns {Promise<Array>} Parsed messages
 */
export async function parseSessionFileMessages(containerManager, userId, filePath, sessionId, jsonlParser) {
  const { stream } = await containerManager.execInContainer(userId, `cat "${filePath}"`);
  const content = await readCommandOutput(stream);
  return jsonlParser.parseMessages(content, sessionId);
}

/**
 * Loads and parses all session files
 * @param {Object} containerManager - Container manager instance
 * @param {number} userId - User ID
 * @param {Array<string>} jsonlFiles - List of JSONL file paths
 * @param {Object} jsonlParser - JSONL parser instance
 * @returns {Promise<Array>} All parsed sessions
 */
export async function loadAllSessionFiles(containerManager, userId, jsonlFiles, jsonlParser) {
  const allSessions = [];

  for (const file of jsonlFiles) {
    try {
      const sessions = await parseSessionFile(containerManager, userId, file, jsonlParser);
      allSessions.push(...sessions);
    } catch (error) {
      logger.warn(`Failed to parse session file ${file}:`, error.message);
    }
  }

  return allSessions;
}

/**
 * Loads messages from multiple session files
 * @param {Object} containerManager - Container manager instance
 * @param {number} userId - User ID
 * @param {Array<string>} jsonlFiles - List of JSONL file paths
 * @param {string} sessionId - Session ID to filter
 * @param {Object} jsonlParser - JSONL parser instance
 * @returns {Promise<Array>} All messages
 */
export async function loadMessagesFromFiles(containerManager, userId, jsonlFiles, sessionId, jsonlParser) {
  const messages = [];

  for (const file of jsonlFiles) {
    try {
      const fileMessages = await parseSessionFileMessages(containerManager, userId, file, sessionId, jsonlParser);
      messages.push(...fileMessages);
    } catch (error) {
      logger.warn(`Failed to parse messages from ${file}:`, error.message);
    }
  }

  return messages;
}
