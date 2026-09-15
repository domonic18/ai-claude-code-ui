/**
 * useSessionLoader Hook
 *
 * Handles loading session messages from the API.
 */

import { useEffect, useRef, useCallback } from 'react';
import { convertSessionMessages } from '../utils/messageConversion';
import type { ChatMessage } from '../types';
import { logger } from '@/shared/utils/logger';

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
  // Track previous session ID to detect changes
  const prevSessionIdRef = useRef<string | null>(null);
  // 跟踪"仍在视图内"的会话 ID：异步 fetch 返回时校验，防止陈旧响应把已切走/
  // 已新建（点 +）会话的消息灌进当前界面（空白新界面被旧消息回填的根因）
  const activeSessionIdRef = useRef<string | null>(null);

  // Clear loaded session ref when session changes (including switching between sessions)
  useEffect(() => {
    const currentId = selectedSession?.id || null;
    activeSessionIdRef.current = currentId;

    // Session changed — clear cache so the new session gets loaded
    if (prevSessionIdRef.current !== currentId) {
      loadedSessionRef.current = null;
      prevSessionIdRef.current = currentId;

      // Clear messages immediately when switching away from current session
      if (currentId) {
        onSetMessages([]);
      }
    }
  }, [selectedSession?.id, onSetMessages]);

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
        logger.info(`[useSessionLoader] Loading messages for session ${selectedSession.id}...`);

        const response = await authenticatedFetch(
          `/api/projects/${selectedProject.name}/sessions/${selectedSession.id}/messages`
        );
        if (!response.ok) {
          logger.error('Failed to load session messages:', response.status);
          return;
        }

        // 陈旧响应守卫：fetch 期间用户已切走（点 + 新建/切其他会话）则丢弃，
        // 防止旧会话消息在新建空白界面上回填
        if (activeSessionIdRef.current !== selectedSession.id) {
          logger.info(`[useSessionLoader] Stale response for ${selectedSession.id}, discarding`);
          return;
        }

        const responseData = await response.json();
        const rawMessages = responseData.data?.messages || [];

        logger.info(`[useSessionLoader] Raw messages from API:`, rawMessages.length, rawMessages);

        // Convert API messages to ChatMessage format using the conversion utility
        // This handles tool result attachment, HTML entity decoding, and message filtering
        const convertedMessages = convertSessionMessages(rawMessages);

        onSetMessages(convertedMessages);
        loadedSessionRef.current = selectedSession.id;
        logger.info(`[useSessionLoader] Loaded ${convertedMessages.length} messages for session ${selectedSession.id}`);
      } catch (error) {
        logger.error('Error loading session messages:', error);
      }
    };

    loadSessionMessages();
  }, [selectedProject?.name, selectedSession?.id, authenticatedFetch, onSetMessages]);
}

export default useSessionLoader;
