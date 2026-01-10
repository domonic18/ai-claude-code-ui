/**
 * WebSocket Writer Module
 *
 * Provides a WebSocket wrapper class that matches the SSEStreamWriter
 * interface for consistent data streaming across different transport types.
 *
 * @module websocket/writer
 */

/**
 * WebSocket Writer - Wrapper for WebSocket to match SSEStreamWriter interface
 * Used by AI providers to send streaming responses
 */
export class WebSocketWriter {
    /**
     * Create a new WebSocket writer
     * @param {WebSocket} ws - The WebSocket connection to wrap
     */
    constructor(ws) {
        this.ws = ws;
        this.sessionId = null;
        this.isWebSocketWriter = true;  // Marker for transport detection
    }

    /**
     * Send data through the WebSocket
     * @param {Object} data - The data object to send (will be JSON stringified)
     */
    send(data) {
        if (this.ws.readyState === 1) { // WebSocket.OPEN
            // Providers send raw objects, we stringify for WebSocket
            this.ws.send(JSON.stringify(data));
        }
    }

    /**
     * Set the session ID for this writer
     * @param {string} sessionId - The session identifier
     */
    setSessionId(sessionId) {
        this.sessionId = sessionId;
    }

    /**
     * Get the current session ID
     * @returns {string|null} The session ID or null if not set
     */
    getSessionId() {
        return this.sessionId;
    }
}
