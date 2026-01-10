/**
 * Chat WebSocket Handler
 *
 * Handles WebSocket connections for chat interactions with AI providers.
 * Routes messages to Claude, Cursor, or Codex based on message type.
 *
 * @module websocket/handlers/chat
 */

import { queryClaudeSDK, abortClaudeSDKSession, isClaudeSDKSessionActive, getActiveClaudeSDKSessions } from '../../services/claude/index.js';
import { queryClaudeSDKInContainer, abortClaudeSDKSessionInContainer, isClaudeSDKSessionActiveInContainer } from '../../services/container/ClaudeSDKContainer.js';
import { spawnCursor, abortCursorSession, isCursorSessionActive, getActiveCursorSessions } from '../../services/cursor/index.js';
import { queryCodex, abortCodexSession, isCodexSessionActive, getActiveCodexSessions } from '../../services/openai/index.js';
import { WebSocketWriter } from '../writer.js';
import { isContainerModeEnabled } from '../../config/container-config.js';

/**
 * Handle chat WebSocket connections
 * @param {WebSocket} ws - The WebSocket connection
 * @param {Set} connectedClients - Set of connected clients for project updates
 */
export function handleChatConnection(ws, connectedClients) {
    console.log('[INFO] Chat WebSocket connected');

    // Add to connected clients for project updates
    connectedClients.add(ws);

    // Wrap WebSocket with writer for consistent interface with SSEStreamWriter
    const writer = new WebSocketWriter(ws);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'claude-command') {
                console.log('[DEBUG] User message:', data.command || '[Continue/Resume]');
                console.log('📁 Project:', data.options?.projectPath || 'Unknown');
                console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');

                // Check if container mode is enabled
                if (isContainerModeEnabled()) {
                    console.log('[DEBUG] Using container mode for Claude SDK');
                    // For container mode, use queryClaudeSDKInContainer
                    // Convert projectPath (e.g., "my/workspace") back to project name (e.g., "my-workspace")
                    const originalProjectName = data.options?.projectPath?.replace(/\//g, '-') || '';
                    const containerOptions = {
                        ...data.options,
                        userId: ws.user.id,
                        isContainerProject: true,
                        projectPath: originalProjectName,
                        // Don't set cwd here - let SDK function determine it based on isContainerProject
                    };
                    await queryClaudeSDKInContainer(data.command, containerOptions, writer);
                } else {
                    // Use Claude Agents SDK (host mode)
                    await queryClaudeSDK(data.command, data.options, writer);
                }
            } else if (data.type === 'cursor-command') {
                console.log('[DEBUG] Cursor message:', data.command || '[Continue/Resume]');
                console.log('📁 Project:', data.options?.cwd || 'Unknown');
                console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
                console.log('🤖 Model:', data.options?.model || 'default');
                await spawnCursor(data.command, data.options, writer);
            } else if (data.type === 'codex-command') {
                console.log('[DEBUG] Codex message:', data.command || '[Continue/Resume]');
                console.log('📁 Project:', data.options?.projectPath || data.options?.cwd || 'Unknown');
                console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
                console.log('🤖 Model:', data.options?.model || 'default');
                await queryCodex(data.command, data.options, writer);
            } else if (data.type === 'cursor-resume') {
                // Backward compatibility: treat as cursor-command with resume and no prompt
                console.log('[DEBUG] Cursor resume session (compat):', data.sessionId);
                await spawnCursor('', {
                    sessionId: data.sessionId,
                    resume: true,
                    cwd: data.options?.cwd
                }, writer);
            } else if (data.type === 'abort-session') {
                console.log('[DEBUG] Abort session request:', data.sessionId);
                const provider = data.provider || 'claude';
                let success;

                if (provider === 'cursor') {
                    success = abortCursorSession(data.sessionId);
                } else if (provider === 'codex') {
                    success = abortCodexSession(data.sessionId);
                } else {
                    // Check if container mode is enabled for Claude SDK
                    if (isContainerModeEnabled()) {
                        success = abortClaudeSDKSessionInContainer(data.sessionId);
                    } else {
                        success = await abortClaudeSDKSession(data.sessionId);
                    }
                }

                writer.send({
                    type: 'session-aborted',
                    sessionId: data.sessionId,
                    provider,
                    success
                });
            } else if (data.type === 'cursor-abort') {
                console.log('[DEBUG] Abort Cursor session:', data.sessionId);
                const success = abortCursorSession(data.sessionId);
                writer.send({
                    type: 'session-aborted',
                    sessionId: data.sessionId,
                    provider: 'cursor',
                    success
                });
            } else if (data.type === 'check-session-status') {
                // Check if a specific session is currently processing
                const provider = data.provider || 'claude';
                const sessionId = data.sessionId;
                let isActive;

                if (provider === 'cursor') {
                    isActive = isCursorSessionActive(sessionId);
                } else if (provider === 'codex') {
                    isActive = isCodexSessionActive(sessionId);
                } else {
                    // Check if container mode is enabled for Claude SDK
                    if (isContainerModeEnabled()) {
                        isActive = isClaudeSDKSessionActiveInContainer(sessionId);
                    } else {
                        isActive = isClaudeSDKSessionActive(sessionId);
                    }
                }

                writer.send({
                    type: 'session-status',
                    sessionId,
                    provider,
                    isProcessing: isActive
                });
            } else if (data.type === 'get-active-sessions') {
                // Get all currently active sessions
                const activeSessions = {
                    claude: getActiveClaudeSDKSessions(),
                    cursor: getActiveCursorSessions(),
                    codex: getActiveCodexSessions()
                };
                writer.send({
                    type: 'active-sessions',
                    sessions: activeSessions
                });
            }
        } catch (error) {
            console.error('[ERROR] Chat WebSocket error:', error.message);
            writer.send({
                type: 'error',
                error: error.message
            });
        }
    });

    ws.on('close', () => {
        console.log('🔌 Chat client disconnected');
        // Remove from connected clients
        connectedClients.delete(ws);
    });
}
