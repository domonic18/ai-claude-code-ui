/**
 * useChatMessages Hook
 *
 * Manages chat message state and operations including:
 * - Message storage and retrieval
 * - LocalStorage persistence
 * - Message CRUD operations
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ChatMessage } from '../types';
import { logger } from '@/shared/utils/logger';
import { safeLocalStorage } from '../utils/safeLocalStorage';

// Stable empty array reference to prevent infinite loops
const EMPTY_MESSAGES: ChatMessage[] = [];

interface UseChatMessagesOptions {
  /** Selected project name for storage key */
  projectName?: string;
  /** Initial messages */
  initialMessages?: ChatMessage[];
  /** External messages from parent component */
  externalMessages?: ChatMessage[];
}

interface UseChatMessagesReturn {
  /** Current messages */
  messages: ChatMessage[];
  /** Add a new message */
  addMessage: (message: ChatMessage) => void;
  /** Update an existing message */
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  /** Remove a message */
  removeMessage: (messageId: string) => void;
  /** Clear all messages */
  clearMessages: () => void;
  /** Set messages externally */
  setMessages: (messages: ChatMessage[]) => void;
}

/**
 * Hook for managing message persistence operations
 */
function useMessagePersistence(
  projectName: string | undefined,
  setMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
) {
  const persistMessages = useCallback((msgs: ChatMessage[]) => {
    if (typeof window !== 'undefined' && projectName) {
      safeLocalStorage.setItem(`chat_messages_${projectName}`, JSON.stringify(msgs));
    }
  }, [projectName]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      persistMessages(newMessages);
      return newMessages;
    });
  }, [persistMessages, setMessages]);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => {
      const newMessages = prev.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg));
      persistMessages(newMessages);
      return newMessages;
    });
  }, [persistMessages, setMessages]);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => {
      const newMessages = prev.filter(msg => msg.id !== messageId);
      persistMessages(newMessages);
      return newMessages;
    });
  }, [persistMessages, setMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (typeof window !== 'undefined' && projectName) {
      safeLocalStorage.removeItem(`chat_messages_${projectName}`);
    }
  }, [projectName, setMessages]);

  const setMessagesDirect = useCallback((newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    persistMessages(newMessages);
  }, [persistMessages, setMessages]);

  return { addMessage, updateMessage, removeMessage, clearMessages, setMessagesDirect };
}

/**
 * Creates initial messages state from localStorage
 */
function createInitialMessages(projectName: string | undefined, stableInitialMessages: ChatMessage[]) {
  if (typeof window !== 'undefined' && projectName) {
    const saved = safeLocalStorage.getItem(`chat_messages_${projectName}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        logger.error('Error parsing saved messages:', e);
      }
    }
  }
  return stableInitialMessages;
}

/**
 * Hook for managing chat messages with localStorage persistence
 *
 * @param options - Hook options
 * @returns Message state and operations
 */
export function useChatMessages(options: UseChatMessagesOptions = {}): UseChatMessagesReturn {
  const { projectName, initialMessages, externalMessages } = options;
  const stableInitialMessages = useMemo(() => initialMessages ?? EMPTY_MESSAGES, [initialMessages]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => createInitialMessages(projectName, stableInitialMessages));
  const prevProjectNameRef = useRef<string | undefined>(projectName);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const prevExternalMessagesRef = useRef<ChatMessage[] | undefined>();

  // Reload messages when projectName actually changes
  useEffect(() => {
    if (prevProjectNameRef.current === projectName) return;
    prevProjectNameRef.current = projectName;

    if (typeof window !== 'undefined' && projectName) {
      const saved = safeLocalStorage.getItem(`chat_messages_${projectName}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setMessages(parsed);
          return;
        } catch (e) {
          logger.error('Error parsing saved messages on project change:', e);
        }
      }
    }
    if (!externalMessages) {
      setMessages(stableInitialMessages);
    }
  }, [projectName, stableInitialMessages, externalMessages]);

  // Sync with external messages
  useEffect(() => {
    if (externalMessages && externalMessages !== prevExternalMessagesRef.current) {
      prevExternalMessagesRef.current = externalMessages;
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  const persistenceOps = useMessagePersistence(projectName, setMessages);

  return {
    messages,
    ...persistenceOps,
    setMessages: persistenceOps.setMessagesDirect,
  };
}
