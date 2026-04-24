/**
 * PTY Stream Handlers
 *
 * Stream event handlers for PTY sessions.
 * Extracted from PtyContainer.js to reduce complexity.
 *
 * @module services/container/ptyStreamHandlers
 */

import { createLogger } from '../../utils/logger.js';
const logger = createLogger('services/container/ptyStreamHandlers');

/**
 * Set up stream event handlers for a PTY session
 * @param {string} sessionId - Session ID
 * @param {object} stream - Docker exec stream
 * @param {object} ws - WebSocket connection
 * @param {Map} ptySessions - Map of PTY sessions
 * @param {Function} cleanupCallback - Cleanup callback function
 */
export function setupStreamHandlers(sessionId, stream, ws, ptySessions, cleanupCallback) {
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
    logger.error({ err: error, sessionId }, 'PTY stream error for session');

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'error',
        sessionId,
        error: error.message
      }));
    }

    // Mark session as errored
    const session = ptySessions.get(sessionId);
    if (session) {
      session.status = 'error';
      session.error = error.message;
    }
  });

  // Handle stream end
  stream.on('end', () => {
    logger.info(`PTY stream ended for session ${sessionId}`);

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
    cleanupCallback(sessionId);
  });
}
