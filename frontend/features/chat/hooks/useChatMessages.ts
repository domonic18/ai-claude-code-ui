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
import { MAX_STORED_MESSAGES, MIN_STORED_MESSAGES } from '../constants';

/**
 * Safe localStorage utility to handle quota exceeded errors
 */
const safeLocalStorage = {
  setItem: (key: string, value: string) => {
    try {
      // For chat messages, implement size limits
      if (key.startsWith('chat_messages_') && typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          // Limit to last MAX_STORED_MESSAGES to prevent storage bloat
          if (Array.isArray(parsed) && parsed.length > MAX_STORED_MESSAGES) {
            console.warn(`Truncating chat history for ${key} from ${parsed.length} to ${MAX_STORED_MESSAGES} messages`);
            const truncated = parsed.slice(-MAX_STORED_MESSAGES);
            value = JSON.stringify(truncated);
          }
        } catch (parseError) {
          console.warn('Could not parse chat messages for truncation:', parseError);
        }
      }

      localStorage.setItem(key, value);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data');
        // Clear old chat messages to free up space
        const keys = Object.keys(localStorage);
        const chatKeys = keys.filter(k => k.startsWith('chat_messages_')).sort();

        // Remove oldest chat data first, keeping only the 3 most recent projects
        if (chatKeys.length > 3) {
          chatKeys.slice(0, chatKeys.length - 3).forEach(k => {
            localStorage.removeItem(k);
            console.log(`Removed old chat data: ${k}`);
          });
        }

        // If still failing, clear draft inputs too
        const draftKeys = keys.filter(k => k.startsWith('draft_input_'));
        draftKeys.forEach(k => {
          localStorage.removeItem(k);
        });

        // Try again with reduced data
        try {
          localStorage.setItem(key, value);
        } catch (retryError) {
          console.error('Failed to save to localStorage even after cleanup:', retryError);
          // Last resort: Try to save just the last MIN_STORED_MESSAGES
          if (key.startsWith('chat_messages_') && typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed) && parsed.length > MIN_STORED_MESSAGES) {
                const minimal = parsed.slice(-MIN_STORED_MESSAGES);
                localStorage.setItem(key, JSON.stringify(minimal));
                console.warn(`Saved only last ${MIN_STORED_MESSAGES} messages due to quota constraints`);
              }
            } catch (finalError) {
              console.error('Final save attempt failed:', finalError);
            }
          }
        }
      } else {
        console.error('localStorage error:', error);
      }
    }
  },
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('localStorage getItem error:', error);
      return null;
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('localStorage removeItem error:', error);
    }
  }
};

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
 * Hook for managing chat messages with localStorage persistence
 *
 * @param options - Hook options
 * @returns Message state and operations
 */
export function useChatMessages(options: UseChatMessagesOptions = {}): UseChatMessagesReturn {
  const { projectName, initialMessages, externalMessages } = options;

  // Use stable reference for initial messages to prevent infinite loops
  // This is critical - using a default value like [] in destructuring creates a new reference every render
  const stableInitialMessages = useMemo(() => {
    return initialMessages ?? EMPTY_MESSAGES;
  }, [initialMessages]);

  // Initialize messages from localStorage or use initial/external messages
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined' && projectName) {
      const saved = safeLocalStorage.getItem(`chat_messages_${projectName}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing saved messages:', e);
        }
      }
    }
    return stableInitialMessages;
  });

  // Track previous projectName to detect actual changes
  const prevProjectNameRef = useRef<string | undefined>(projectName);

  // Reload messages when projectName actually changes (not on every render)
  useEffect(() => {
    // Only reload if projectName actually changed
    if (prevProjectNameRef.current === projectName) {
      return;
    }
    prevProjectNameRef.current = projectName;

    if (typeof window !== 'undefined' && projectName) {
      const saved = safeLocalStorage.getItem(`chat_messages_${projectName}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setMessages(parsed);
          return;
        } catch (e) {
          console.error('Error parsing saved messages on project change:', e);
        }
      }
    }
    // If no saved messages and no external messages being synced, clear
    if (!externalMessages) {
      setMessages(stableInitialMessages);
    }
  }, [projectName, stableInitialMessages, externalMessages]);

  // Ref to track messages for scroll restoration
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Persist messages to localStorage when they change
  const persistMessages = useCallback((msgs: ChatMessage[]) => {
    if (typeof window !== 'undefined' && projectName) {
      safeLocalStorage.setItem(`chat_messages_${projectName}`, JSON.stringify(msgs));
    }
  }, [projectName]);

  // Track previous external messages reference to detect actual changes
  const prevExternalMessagesRef = useRef<ChatMessage[] | undefined>();

  // Sync with external messages (only when externalMessages actually changes)
  useEffect(() => {
    // Only sync if externalMessages actually changed (reference comparison)
    if (externalMessages && externalMessages !== prevExternalMessagesRef.current) {
      prevExternalMessagesRef.current = externalMessages;
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  /**
   * Add a new message to the chat
   */
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      persistMessages(newMessages);
      return newMessages;
    });
  }, [persistMessages]);

  /**
   * Update an existing message
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => {
      const newMessages = prev.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      persistMessages(newMessages);
      return newMessages;
    });
  }, [persistMessages]);

  /**
   * Remove a message from the chat
   */
  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => {
      const newMessages = prev.filter(msg => msg.id !== messageId);
      persistMessages(newMessages);
      return newMessages;
    });
  }, [persistMessages]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    if (typeof window !== 'undefined' && projectName) {
      safeLocalStorage.removeItem(`chat_messages_${projectName}`);
    }
  }, [projectName]);

  /**
   * Set messages (for external control)
   */
  const setMessagesDirect = useCallback((newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    persistMessages(newMessages);
  }, [persistMessages]);

  return {
    messages,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    setMessages: setMessagesDirect,
  };
}
