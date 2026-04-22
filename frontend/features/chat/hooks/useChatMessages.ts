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
  // 使用稳定的空数组引用，防止无限循环
  const stableInitialMessages = useMemo(() => initialMessages ?? EMPTY_MESSAGES, [initialMessages]);
  // 消息列表状态：存储当前会话的所有聊天消息
  const [messages, setMessages] = useState<ChatMessage[]>(() => createInitialMessages(projectName, stableInitialMessages));
  // 上一个项目名称引用：用于检测项目切换
  const prevProjectNameRef = useRef<string | undefined>(projectName);
  // 消息列表引用：用于在回调中访问最新消息，避免闭包陷阱
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // 上一次外部消息引用：用于检测外部消息变化
  const prevExternalMessagesRef = useRef<ChatMessage[] | undefined>();

  // 监听项目名称变化：切换项目时重新加载对应项目的消息历史
  useEffect(() => {
    if (prevProjectNameRef.current === projectName) return;
    prevProjectNameRef.current = projectName;

    // 尝试从 LocalStorage 加载该项目的历史消息
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
    // 没有历史消息时，使用初始消息
    if (!externalMessages) {
      setMessages(stableInitialMessages);
    }
  }, [projectName, stableInitialMessages, externalMessages]);

  // 同步外部消息：当父组件传入的消息发生变化时更新本地状态
  useEffect(() => {
    if (externalMessages && externalMessages !== prevExternalMessagesRef.current) {
      prevExternalMessagesRef.current = externalMessages;
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  // 消息持久化操作：添加、更新、删除消息时自动保存到 LocalStorage
  const persistenceOps = useMessagePersistence(projectName, setMessages);

  return {
    messages,
    ...persistenceOps,
    setMessages: persistenceOps.setMessagesDirect,
  };
}
