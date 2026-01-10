/**
 * PTY Container Integration
 *
 * Containerized version of PTY (pseudo-terminal) handling.
 * Creates terminal sessions inside user-isolated Docker containers.
 *
 * Key features:
 * - Container-isolated PTY sessions
 * - Session management with cleanup
 * - WebSocket communication
 * - Terminal buffer management
 */

import containerManager from './ContainerManager.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// PTY session storage: sessionId -> sessionInfo
const ptySessions = new Map();

// Active PTY streams: sessionId -> stream
const ptyStreams = new Map();

/**
 * Create a PTY session inside a user container
 * @param {object} ws - WebSocket connection
 * @param {object} options - PTY options
 * @returns {Promise<object>} Session information
 */
export async function createPtyInContainer(ws, options) {
  const {
    userId,
    projectPath = '',
    sessionId = uuidv4(),
    initialCommand = 'bash',
    cols = 80,
    rows = 24,
    userTier = 'free'
  } = options;

  try {
    // 1. Get or create user container
    const container = await containerManager.getOrCreateContainer(userId, {
      tier: userTier
    });

    // 2. Check if session already exists
    if (ptySessions.has(sessionId)) {
      const existingSession = ptySessions.get(sessionId);
      if (existingSession.status === 'active') {
        return existingSession;
      }
    }

    // 3. Build shell command
    const shellCommand = buildShellCommand(projectPath, initialCommand);

    // 4. Create exec with TTY
    const exec = await containerManager.docker.getContainer(container.id).exec({
      Cmd: ['/bin/bash', '-c', shellCommand],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      WorkingDir: '/workspace',
      Env: [
        'TERM=xterm-256color',
        'COLORTERM=truecolor',
        `COLUMNS=${cols}`,
        `LINES=${rows}`,
        'FORCE_COLOR=3'
      ]
    });

    // 5. Start exec stream
    const stream = await exec.start({ Detach: false, Tty: true });

    // 6. Create session info
    const sessionInfo = {
      sessionId,
      userId,
      containerId: container.id,
      execId: exec.id,
      status: 'active',
      cols,
      rows,
      projectPath,
      buffer: [],
      bufferSize: 5000,
      createdAt: new Date(),
      lastActive: new Date()
    };

    // 7. Store session and stream
    ptySessions.set(sessionId, sessionInfo);
    ptyStreams.set(sessionId, { stream, exec, ws });

    // 8. Setup stream handlers
    setupStreamHandlers(sessionId, stream, ws);

    // 9. Send session started message
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'session_started',
        sessionId,
        containerId: container.id,
        message: 'PTY session started in container'
      }));
    }

    return sessionInfo;

  } catch (error) {
    // Send error to client
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'error',
        sessionId,
        error: `Failed to create PTY: ${error.message}`
      }));
    }

    throw error;
  }
}

/**
 * Build shell command for container execution
 * @param {string} projectPath - Project path (optional)
 * @param {string} initialCommand - Initial command to run
 * @returns {string} Complete shell command
 */
function buildShellCommand(projectPath, initialCommand) {
  let command = '';

  // Change to project directory if specified
  if (projectPath) {
    const workspaceProjectPath = projectPath.replace(/^.*:/, '/workspace');
    command += `cd "${workspaceProjectPath}" && `;
  }

  // Run initial command or default shell
  command += initialCommand || 'bash';

  return command;
}

/**
 * Setup stream handlers for PTY session
 * @param {string} sessionId - Session ID
 * @param {object} stream - Docker exec stream
 * @param {object} ws - WebSocket connection
 */
function setupStreamHandlers(sessionId, stream, ws) {
  // Handle output from container
  stream.on('data', (data) => {
    const output = data.toString();

    // Update session info
    const session = ptySessions.get(sessionId);
    if (session) {
      session.lastActive = new Date();

      // Add to buffer
      if (session.buffer.length >= session.bufferSize) {
        session.buffer.shift();
      }
      session.buffer.push(output);
    }

    // Send to WebSocket
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'output',
        sessionId,
        data: output
      }));
    }
  });

  // Handle stream errors
  stream.on('error', (error) => {
    console.error(`PTY stream error for session ${sessionId}:`, error.message);

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'error',
        sessionId,
        error: error.message
      }));
    }

    // Mark session as error
    const session = ptySessions.get(sessionId);
    if (session) {
      session.status = 'error';
      session.error = error.message;
    }
  });

  // Handle stream end
  stream.on('end', () => {
    console.log(`PTY stream ended for session ${sessionId}`);

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'session_ended',
        sessionId
      }));
    }

    // Mark session as ended
    const session = ptySessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endedAt = new Date();
    }
  });

  // Handle WebSocket close
  ws.on('close', () => {
    cleanupPtySession(sessionId);
  });
}

/**
 * Send input to container PTY
 * @param {string} sessionId - Session ID
 * @param {string} input - Input to send
 * @returns {Promise<boolean>} True if successful
 */
export async function sendInputToPty(sessionId, input) {
  const sessionData = ptyStreams.get(sessionId);

  if (!sessionData) {
    throw new Error(`No active PTY session found: ${sessionId}`);
  }

  const { stream } = sessionData;

  try {
    stream.write(input);
    return true;
  } catch (error) {
    throw new Error(`Failed to send input to PTY: ${error.message}`);
  }
}

/**
 * Resize PTY session
 * @param {string} sessionId - Session ID
 * @param {number} cols - New columns
 * @param {number} rows - New rows
 * @returns {Promise<boolean>} True if successful
 */
export async function resizePty(sessionId, cols, rows) {
  const session = ptySessions.get(sessionId);

  if (!session) {
    throw new Error(`No PTY session found: ${sessionId}`);
  }

  const sessionData = ptyStreams.get(sessionId);
  if (!sessionData) {
    throw new Error(`No active stream for session: ${sessionId}`);
  }

  try {
    // Update session info
    session.cols = cols;
    session.rows = rows;

    // Note: Dockerode doesn't support resizing exec after creation
    // This would need to be implemented with a new approach
    // For now, we just update the stored dimensions

    return true;
  } catch (error) {
    throw new Error(`Failed to resize PTY: ${error.message}`);
  }
}

/**
 * End PTY session
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} True if successful
 */
export async function endPtySession(sessionId) {
  return cleanupPtySession(sessionId);
}

/**
 * Cleanup PTY session
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} True if cleaned up
 */
async function cleanupPtySession(sessionId) {
  const sessionData = ptyStreams.get(sessionId);
  const session = ptySessions.get(sessionId);

  if (sessionData) {
    const { stream, exec } = sessionData;

    try {
      // Close stream
      if (stream && !stream.destroyed) {
        stream.destroy();
      }
    } catch (error) {
      console.error(`Error closing stream for session ${sessionId}:`, error.message);
    }

    // Remove from streams map
    ptyStreams.delete(sessionId);
  }

  if (session) {
    // Mark session as ended
    session.status = 'ended';
    session.endedAt = new Date();

    // Remove from sessions map
    ptySessions.delete(sessionId);
  }

  return true;
}

/**
 * Get PTY session info
 * @param {string} sessionId - Session ID
 * @returns {object|undefined} Session info
 */
export function getPtySessionInfo(sessionId) {
  return ptySessions.get(sessionId);
}

/**
 * Get all active PTY sessions
 * @returns {Array} Array of active sessions
 */
export function getActivePtySessions() {
  return Array.from(ptySessions.values())
    .filter(session => session.status === 'active');
}

/**
 * Get PTY sessions by user ID
 * @param {number} userId - User ID
 * @returns {Array} Array of user's sessions
 */
export function getPtySessionsByUserId(userId) {
  return Array.from(ptySessions.values())
    .filter(session => session.userId === userId);
}

/**
 * End all PTY sessions for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} Number of sessions ended
 */
export async function endAllPtySessionsForUser(userId) {
  const sessions = getPtySessionsByUserId(userId);
  let count = 0;

  for (const session of sessions) {
    try {
      await cleanupPtySession(session.sessionId);
      count++;
    } catch (error) {
      console.error(`Failed to end session ${session.sessionId}:`, error.message);
    }
  }

  return count;
}

/**
 * Get session buffer
 * @param {string} sessionId - Session ID
 * @returns {string} Buffer content
 */
export function getPtySessionBuffer(sessionId) {
  const session = ptySessions.get(sessionId);

  if (!session) {
    return '';
  }

  return session.buffer.join('');
}

/**
 * Cleanup idle PTY sessions
 * @param {number} idleTime - Idle time in milliseconds (default: 1 hour)
 * @returns {number} Number of sessions cleaned up
 */
export function cleanupIdlePtySessions(idleTime = 60 * 60 * 1000) {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of ptySessions.entries()) {
    const timeSinceActive = now - session.lastActive.getTime();

    if (timeSinceActive > idleTime && session.status === 'active') {
      cleanupPtySession(sessionId);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

// Start periodic cleanup
setInterval(() => {
  const count = cleanupIdlePtySessions();
  if (count > 0) {
    console.log(`Cleaned up ${count} idle PTY sessions`);
  }
}, 30 * 60 * 1000); // Every 30 minutes
