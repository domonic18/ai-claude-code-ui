/**
 * WebSocket Server Module
 *
 * Manages WebSocket server initialization, authentication, and
 * connection routing based on URL paths.
 *
 * @module websocket/server
 */

import { WebSocketServer } from 'ws';
import { authenticateWebSocket } from '../middleware/auth.js';
import { handleChatConnection } from './handlers/chat.js';
import { handleShellConnection } from './handlers/shell.js';

/**
 * Create and configure WebSocket server
 * @param {http.Server} server - The HTTP server to attach WebSocket to
 * @param {Set} connectedClients - Set of connected clients for project updates
 * @param {Map} ptySessionsMap - Map for managing PTY sessions
 * @returns {WebSocketServer} The configured WebSocket server
 */
export function createWebSocketServer(server, connectedClients, ptySessionsMap) {
    // Create WebSocket server with authentication
    const wss = new WebSocketServer({
        server,
        verifyClient: (info) => {
            console.log('WebSocket connection attempt to:', info.req.url);

            // Platform mode: always allow connection
            if (process.env.VITE_IS_PLATFORM === 'true') {
                const user = authenticateWebSocket(null); // Will return first user
                if (!user) {
                    console.log('[WARN] Platform mode: No user found in database');
                    return false;
                }
                info.req.user = user;
                console.log('[OK] Platform mode WebSocket authenticated for user:', user.username);
                return true;
            }

            // Normal mode: verify token
            // Extract token from query parameters or headers
            const url = new URL(info.req.url, 'http://localhost');
            const token = url.searchParams.get('token') ||
                info.req.headers.authorization?.split(' ')[1];

            // Verify token
            const user = authenticateWebSocket(token);
            if (!user) {
                console.log('[WARN] WebSocket authentication failed');
                return false;
            }

            // Store user info in the request for later use
            info.req.user = user;
            console.log('[OK] WebSocket authenticated for user:', user.username);
            return true;
        }
    });

    // Setup connection routing based on URL path
    wss.on('connection', (ws, request) => {
        const url = request.url;
        console.log('[INFO] Client connected to:', url);

        // Parse URL to get pathname without query parameters
        const urlObj = new URL(url, 'http://localhost');
        const pathname = urlObj.pathname;

        if (pathname === '/shell') {
            handleShellConnection(ws, ptySessionsMap);
        } else if (pathname === '/ws') {
            handleChatConnection(ws, connectedClients);
        } else {
            console.log('[WARN] Unknown WebSocket path:', pathname);
            ws.close();
        }
    });

    return wss;
}
