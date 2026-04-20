/**
 * WebSocket Factory Utilities
 *
 * Utility functions for creating WebSocket connections and building
 * initialization messages for terminal connections.
 */

import { logger } from '@/shared/utils/logger';

/**
 * Build initialization message for terminal WebSocket
 * @param params - Connection parameters
 * @returns Initialization message object
 */
export function buildInitMessage(params: {
  selectedProjectRef: React.MutableRefObject<any>;
  selectedSessionRef: React.MutableRefObject<any>;
  initialCommandRef: React.MutableRefObject<string | undefined>;
  isPlainShellRef: React.MutableRefObject<boolean>;
  terminalRef: React.MutableRefObject<any>;
}): object {
  const projectPath = params.selectedProjectRef.current.fullPath || params.selectedProjectRef.current.path;
  const sessionId = params.isPlainShellRef.current ? null : params.selectedSessionRef.current?.id;
  const hasSession = params.isPlainShellRef.current ? false : !!params.selectedSessionRef.current;
  const provider = params.isPlainShellRef.current
    ? 'plain-shell'
    : (params.selectedSessionRef.current?.__provider || 'claude');

  return {
    type: 'init',
    projectPath,
    sessionId,
    hasSession,
    provider,
    cols: params.terminalRef.current.cols,
    rows: params.terminalRef.current.rows,
    initialCommand: params.initialCommandRef.current,
    isPlainShell: params.isPlainShellRef.current
  };
}

/**
 * Determine WebSocket protocol based on current page protocol
 * @returns 'wss:' for HTTPS, 'ws:' otherwise
 */
function getWebSocketProtocol(): string {
  return window.location.protocol === 'https:' ? 'wss:' : 'ws:';
}

/**
 * Fetch WebSocket authentication token
 * @returns Token string or null if fetch fails
 */
async function fetchWebSocketToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/ws-token', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      return data.data?.token || null;
    }
    return null;
  } catch (error) {
    logger.error('[Shell] Error fetching ws-token:', error);
    return null;
  }
}

/**
 * Build WebSocket URL for platform environment
 * @returns WebSocket URL string
 */
function buildPlatformWebSocketUrl(): string {
  const protocol = getWebSocketProtocol();
  return `${protocol}//${window.location.host}/shell`;
}

/**
 * Build WebSocket URL for standalone environment with token
 * @param token - Authentication token
 * @returns WebSocket URL string
 */
function buildStandaloneWebSocketUrl(token: string): string {
  const protocol = getWebSocketProtocol();
  return `${protocol}//${window.location.host}/shell?token=${encodeURIComponent(token)}`;
}

/**
 * Create WebSocket connection with proper URL and token
 * @returns WebSocket instance or null if connection fails
 */
export async function createWebSocket(): Promise<WebSocket | null> {
  const isPlatform = import.meta.env.VITE_IS_PLATFORM === 'true';
  let wsUrl: string;

  if (isPlatform) {
    wsUrl = buildPlatformWebSocketUrl();
  } else {
    const token = await fetchWebSocketToken();
    if (!token) {
      return null;
    }
    wsUrl = buildStandaloneWebSocketUrl(token);
  }

  return new WebSocket(wsUrl);
}
