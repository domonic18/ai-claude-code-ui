/**
 * useChatSessionManagement Hook
 *
 * Extracts session management logic from useChatInterface.
 * Combines session loader, session sync, and new session reset logic.
 *
 * @module useChatSessionManagement
 */

import { useEffect, useRef } from 'react';
import { useSessionLoader } from './useSessionLoader';
import { useSessionSync } from './useSessionSync';

/**
 * Options for useChatSessionManagement hook
 */
interface UseChatSessionManagementOptions {
  /** Selected project */
  selectedProject?: { name: string; path: string };
  /** Selected session */
  selectedSession?: { id: string; __provider?: string };
  /** New session counter */
  newSessionCounter: number;
  /** Current session ID */
  currentSessionId: string | null;
  /** Authenticated fetch function */
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Set session ID callback */
  setCurrentSessionId: (id: string | null) => void;
  /** Set messages callback */
  setMessages: (messages: any[]) => void;
  /** Set input callback */
  setInput: (value: string) => void;
}

/**
 * Hook to manage session lifecycle
 *
 * Handles:
 * - Loading sessions from backend
 * - Syncing session state with parent
 * - Resetting state when new session is created
 *
 * @param options - Hook options
 */
export function useChatSessionManagement(options: UseChatSessionManagementOptions) {
  const prevNewSessionCounterRef = useRef(0);

  // Load session data when selected session changes
  useSessionLoader({
    selectedProject: options.selectedProject,
    selectedSession: options.selectedSession,
    authenticatedFetch: options.authenticatedFetch,
    onSetMessages: options.setMessages,
  });

  // Sync session state with parent component
  useSessionSync({
    selectedSession: options.selectedSession,
    selectedProject: options.selectedProject,
    currentSessionId: options.currentSessionId,
    setCurrentSessionId: options.setCurrentSessionId,
    setMessages: options.setMessages,
  });

  // Force state reset when new session counter changes (user clicked "New Session")
  useEffect(() => {
    if (options.newSessionCounter > prevNewSessionCounterRef.current) {
      prevNewSessionCounterRef.current = options.newSessionCounter;
      options.setCurrentSessionId(null);
      options.setMessages([]);
      options.setInput('');
    }
  }, [options.newSessionCounter, options.setCurrentSessionId, options.setMessages, options.setInput]);
}
