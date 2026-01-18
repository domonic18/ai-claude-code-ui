/**
 * useSessionLoader Hook
 *
 * Handles loading session messages from the API.
 */

import { useEffect, useRef, useCallback } from 'react';
import { convertSessionMessages } from '../utils/messageConversion';
import type { ChatMessage } from '../types';

export interface UseSessionLoaderOptions {
  /** Selected project */
  selectedProject?: {
    name: string;
  };
  /** Selected session */
  selectedSession?: {
    id: string;
    __provider?: string;
  };
  /** Authenticated fetch function */
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Callback to set messages */
  onSetMessages: (messages: ChatMessage[]) => void;
}

/**
 * Hook for loading session messages
 *
 * @param options - Hook options
 */
export function useSessionLoader(options: UseSessionLoaderOptions): void {
  const {
    selectedProject,
    selectedSession,
    authenticatedFetch,
    onSetMessages,
  } = options;

  // Ref to track which session's messages have been loaded
  const loadedSessionRef = useRef<string | null>(null);

  // Clear loaded session ref when session changes
  useEffect(() => {
    if (!selectedSession?.id) {
      // Clear loaded session ref when no session selected (new chat)
      loadedSessionRef.current = null;
    }
  }, [selectedSession?.id]);

  // Load session messages when session or project changes
  useEffect(() => {
    const loadSessionMessages = async () => {
      if (!selectedProject?.name || !selectedSession?.id) {
        return;
      }

      // Skip loading if we already loaded this session
      if (loadedSessionRef.current === selectedSession.id) {
        return;
      }

      try {
        console.log(`[useSessionLoader] Loading messages for session ${selectedSession.id}...`);

        const response = await authenticatedFetch(
          `/api/projects/${selectedProject.name}/sessions/${selectedSession.id}/messages`
        );
        if (!response.ok) {
          console.error('Failed to load session messages:', response.status);
          return;
        }

        const responseData = await response.json();
        const rawMessages = responseData.data?.messages || [];

        console.log(`[useSessionLoader] Raw messages from API:`, rawMessages.length, rawMessages);

        // Convert API messages to ChatMessage format using the conversion utility
        // This handles tool result attachment, HTML entity decoding, and message filtering
        const convertedMessages = convertSessionMessages(rawMessages);

        onSetMessages(convertedMessages);
        loadedSessionRef.current = selectedSession.id;
        console.log(`[useSessionLoader] Loaded ${convertedMessages.length} messages for session ${selectedSession.id}`);
      } catch (error) {
        console.error('Error loading session messages:', error);
      }
    };

    loadSessionMessages();
  }, [selectedProject?.name, selectedSession?.id, authenticatedFetch, onSetMessages]);
}

export default useSessionLoader;
