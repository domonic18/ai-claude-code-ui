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
  const prevProjectNameRef = useRef<string | undefined>(options.selectedProject?.name);
  const prevNewSessionCounterRef = useRef(0);

  // 切换项目时最先重置会话状态：清空 currentSessionId，避免切到项目 B 后残留项目 A 的
  // sessionId，导致下次发送以 projectPath=B、sessionId=A 的错配请求 resume（对话串到错误项目）。
  // 放在 useSessionLoader/useSessionSync 之前执行：若切项目同时选中该项目的历史会话，
  // useSessionSync 会随后把 sessionId 设回历史会话 id，不被本清理覆盖。
  // 首次挂载（prevName === undefined）跳过，避免误清首屏恢复的会话。
  useEffect(() => {
    const prevName = prevProjectNameRef.current;
    const nextName = options.selectedProject?.name;
    prevProjectNameRef.current = nextName;
    if (prevName !== undefined && prevName !== nextName) {
      options.setCurrentSessionId(null);
      options.setMessages([]);
      options.setInput('');
    }
  }, [options.selectedProject?.name, options.setCurrentSessionId, options.setMessages, options.setInput]);

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
