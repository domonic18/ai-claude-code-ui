/**
 * Claude SDK Container Integration
 *
 * Containerized version of Claude SDK integration.
 * Executes Claude commands inside user-isolated Docker containers.
 *
 * Key features:
 * - Container-isolated execution
 * - Session management with abort capability
 * - Streaming output handling
 * - WebSocket message streaming
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import containerManager from './ContainerManager.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Session tracking for containerized queries
const containerSessions = new Map();

/**
 * Execute Claude SDK query inside a user container
 * @param {string} command - User command
 * @param {object} options - Execution options
 * @param {object} writer - WebSocket writer for streaming
 * @returns {Promise<string>} Session ID
 */
export async function queryClaudeSDKInContainer(command, options = {}, writer) {
  const {
    userId,
    sessionId = uuidv4(),
    cwd,
    userTier = 'free',
    isContainerProject = false,
    projectPath = '',
    ...sdkOptions
  } = options;

  try {
    // 1. Get or create user container
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: userTier
    });

    // 2. Build SDK options with correct working directory
    // For container projects, use /home/node/.claude/projects/{projectPath}
    // For workspace files, use /workspace/{path}
    let workingDir;
    if (isContainerProject && projectPath) {
      // Container project: use the projects directory
      workingDir = `/home/node/.claude/projects/${projectPath}`;
    } else if (cwd) {
      // Workspace files: extract basename and use /workspace
      workingDir = `/workspace/${path.basename(cwd)}`;
    } else {
      workingDir = '/workspace';
    }

    const mappedOptions = {
      ...sdkOptions,
      sessionId,
      cwd: workingDir
    };

    // 3. Create session info
    const sessionInfo = {
      userId,
      sessionId,
      containerId: container.id,
      command,
      options: mappedOptions,
      startTime: Date.now(),
      status: 'running'
    };

    containerSessions.set(sessionId, sessionInfo);

    // 4. Send initial message
    if (writer) {
      writer.send({
        type: 'session_start',
        sessionId,
        containerId: container.id,
        message: 'Starting containerized Claude session...'
      });
    }

    // 5. Execute in container via node script
    const execResult = await executeSDKInContainer(
      container.id,
      command,
      mappedOptions,
      writer,
      sessionId
    );

    // 6. Update session status
    sessionInfo.status = 'completed';
    sessionInfo.endTime = Date.now();

    return sessionId;

  } catch (error) {
    // Update session status on error
    if (sessionId && containerSessions.has(sessionId)) {
      const session = containerSessions.get(sessionId);
      session.status = 'error';
      session.error = error.message;
      session.endTime = Date.now();
    }

    if (writer) {
      writer.send({
        type: 'error',
        sessionId,
        error: error.message
      });
    }

    throw error;
  }
}

/**
 * Execute SDK query inside container
 * @param {string} containerId - Container ID
 * @param {string} command - Command to execute
 * @param {object} options - SDK options
 * @param {object} writer - WebSocket writer
 * @param {string} sessionId - Session ID
 * @returns {Promise<object>} Execution result
 */
async function executeSDKInContainer(containerId, command, options, writer, sessionId) {
  try {
    // Build Node.js script to run SDK inside container
    const sdkScript = buildSDKScript(command, options);

    // Execute in container
    const { stream } = await containerManager.execInContainer(
      options.userId,
      sdkScript,
      {
        cwd: options.cwd || '/workspace',
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
          ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL
        }
      }
    );

    // Collect output
    const chunks = [];
    let errorOutput = '';

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const output = chunk.toString();
        chunks.push(output);

        // Send to WebSocket if available
        if (writer && writer.readyState === 1) {
          try {
            // Try to parse as JSON for structured output
            const jsonData = tryParseJSON(output);
            if (jsonData && jsonData.type) {
              writer.send(jsonData);
            } else {
              writer.send({
                type: 'output',
                sessionId,
                data: output
              });
            }
          } catch (e) {
            // Send as plain text
            writer.send({
              type: 'output',
              sessionId,
              data: output
            });
          }
        }
      });

      stream.on('error', (chunk) => {
        errorOutput += chunk.toString();
      });

      stream.on('end', () => {
        const fullOutput = chunks.join('');

        if (errorOutput) {
          reject(new Error(`SDK execution error: ${errorOutput}`));
        } else {
          resolve({ output: fullOutput, sessionId });
        }
      });
    });

  } catch (error) {
    throw new Error(`Failed to execute SDK in container: ${error.message}`);
  }
}

/**
 * Build Node.js script to execute SDK query
 * @param {string} command - Command to execute
 * @param {object} options - SDK options
 * @returns {string} Node.js script
 */
function buildSDKScript(command, options) {
  const sdkOptions = JSON.stringify(options);

  return `node -e "
  const { query } = require('@anthropic-ai/claude-agent-sdk');

  async function execute() {
    try {
      const options = ${sdkOptions};
      const result = await query('${command.replace(/'/g, "\\'")}', options);

      // Stream output
      for await (const chunk of result) {
        if (chunk.content) {
          console.log(JSON.stringify({
            type: 'content',
            content: chunk.content
          }));
        }
      }

      console.log(JSON.stringify({
        type: 'done',
        sessionId: '${options.sessionId}'
      }));

    } catch (error) {
      console.error(JSON.stringify({
        type: 'error',
        error: error.message
      }));
      process.exit(1);
    }
  }

  execute();
"`;
}

/**
 * Abort a containerized SDK session
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if session was aborted
 */
export function abortClaudeSDKSessionInContainer(sessionId) {
  const session = containerSessions.get(sessionId);

  if (!session) {
    return false;
  }

  session.status = 'aborted';
  session.endTime = Date.now();

  // Note: Actual abort would require killing the exec process
  // This is a simplified implementation
  containerSessions.delete(sessionId);

  return true;
}

/**
 * Check if a containerized SDK session is active
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if session is active
 */
export function isClaudeSDKSessionActiveInContainer(sessionId) {
  const session = containerSessions.get(sessionId);
  return session && session.status === 'running';
}

/**
 * Get active containerized SDK sessions
 * @returns {Array} Array of active session info
 */
export function getActiveClaudeSDKSessionsInContainer() {
  return Array.from(containerSessions.values())
    .filter(session => session.status === 'running');
}

/**
 * Get session info
 * @param {string} sessionId - Session ID
 * @returns {object|undefined} Session info
 */
export function getContainerSessionInfo(sessionId) {
  return containerSessions.get(sessionId);
}

/**
 * Try to parse JSON, return null if invalid
 * @param {string} str - String to parse
 * @returns {object|null} Parsed object or null
 */
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// Re-export non-containerized functions for backward compatibility
export {
  abortClaudeSDKSessionInContainer as abortClaudeSDKSession,
  isClaudeSDKSessionActiveInContainer as isClaudeSDKSessionActive,
  getActiveClaudeSDKSessionsInContainer as getActiveClaudeSDKSessions
};
