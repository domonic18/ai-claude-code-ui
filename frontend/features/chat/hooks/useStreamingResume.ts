/**
 * useStreamingResume Hook
 *
 * 刷新续传：页面刷新 / WS 重连后，若本地记录了"刷新前正在流式的 sessionId"，
 * 则向后端发送 subscribe-session。后端若任务仍在跑则替换 writer 并回 session-resumed，
 * 本 hook 据此恢复流式 UI（startStream + handleSessionProcessing + setIsLoading），
 * 使重连后的 delta 流入新的流式气泡、输入框保持禁用；若任务已结束则回
 * session-status:false，清除本地标记，交由正常历史加载。
 *
 * 时序保证：后端在替换 writer 后才回 session-resumed，且 session-resumed 严格先于
 * 后续 delta 到达；本 hook 必须在 useChatWebSocketProcessor 之前装配（React effect
 * 按声明顺序同步执行），确保恢复 startStream 先于 delta 被 processor 处理。
 *
 * @module useStreamingResume
 */

import { useEffect, useRef } from 'react';
import { useWebSocketContext } from '@/shared/contexts/WebSocketContext';
import { safeLocalStorage } from '../services/wsUtils';
import { logger } from '@/shared/utils/logger';

export interface UseStreamingResumeOptions {
  /** 当前项目名，用于隔离 localStorage key */
  projectKey?: string;
  /** WebSocket 消息数组（与 useChatInterface 同源） */
  wsMessages: any[];
  /** 任务仍在跑：恢复流式态（startStream + handleSessionProcessing + setIsLoading） */
  onResumed: (sessionId: string) => void;
  /** 任务已结束/不存在：清除本地标记，交由历史加载 */
  onNotActive: (sessionId: string) => void;
}

/** 计算按项目隔离的持久化 key */
function storageKey(projectKey?: string): string {
  return projectKey ? `activeStreamingSession_${projectKey}` : 'activeStreamingSession';
}

/**
 * 写入"刷新前正在流式的 sessionId"（发送消息进入处理态时调用）
 */
export function persistActiveStreamingSession(projectKey: string | undefined, sessionId: string): void {
  safeLocalStorage.setItem(storageKey(projectKey), sessionId);
}

/**
 * 同步更新持久化的 sessionId（temp→real 替换时调用）
 */
export function replaceActiveStreamingSession(projectKey: string | undefined, oldId: string, newId: string): void {
  const key = storageKey(projectKey);
  if (safeLocalStorage.getItem(key) === oldId) {
    safeLocalStorage.setItem(key, newId);
  }
}

/**
 * 清除"刷新前正在流式的 sessionId"（流式正常结束/中止时调用）
 */
export function clearActiveStreamingSession(projectKey: string | undefined): void {
  safeLocalStorage.removeItem(storageKey(projectKey));
}

/**
 * 刷新续传 Hook
 *
 * @param options - Hook 选项
 */
export function useStreamingResume({ projectKey, wsMessages, onResumed, onNotActive }: UseStreamingResumeOptions): void {
  const { isConnected, sendMessage } = useWebSocketContext();

  // 本连接是否已发过 subscribe（每次重连重置）
  const subscribedRef = useRef(false);
  // 本次订阅等待响应的 sessionId（去重响应处理）
  const pendingRef = useRef<string | null>(null);
  // 已消费的 wsMessages 数量（增量消费，避免重复处理）
  const processedCountRef = useRef(0);

  // 回调 ref 中转：保持最新引用，避免 stale closure（符合 Observer/Timer 回调的 ref 中转规范）
  const onResumedRef = useRef(onResumed);
  const onNotActiveRef = useRef(onNotActive);
  onResumedRef.current = onResumed;
  onNotActiveRef.current = onNotActive;

  // 连接建立（含重连）后：若本地有活跃 session 标记，发 subscribe
  useEffect(() => {
    const keyName = storageKey(projectKey);
    const sessionId = safeLocalStorage.getItem(keyName);
    logger.info('[useStreamingResume] effect tick', {
      isConnected, projectKey, subscribed: subscribedRef.current,
      keyName, hasKey: !!sessionId,
    });
    if (!isConnected) {
      // 连接断开：重置订阅状态，等待下次重连重新订阅
      subscribedRef.current = false;
      return;
    }
    if (subscribedRef.current) return; // 本连接已订阅过
    if (!sessionId) return;

    subscribedRef.current = true;
    pendingRef.current = sessionId;
    logger.info('[useStreamingResume] Connected, subscribing session:', sessionId);
    sendMessage({ type: 'subscribe-session', sessionId });
  }, [isConnected, projectKey, sendMessage]);

  // 消费 wsMessages，匹配 subscribe 响应（session-resumed / session-status:false）
  useEffect(() => {
    if (wsMessages.length === 0) return;
    const newMessages = wsMessages.slice(processedCountRef.current);
    if (newMessages.length === 0) return;

    for (const msg of newMessages) {
      const pending = pendingRef.current;
      if (!pending) continue;
      if (msg.type === 'session-resumed' && msg.sessionId === pending) {
        pendingRef.current = null;
        logger.info('[useStreamingResume] Session resumed, restoring streaming UI:', pending);
        onResumedRef.current(pending);
      } else if (msg.type === 'session-status' && msg.sessionId === pending && msg.isProcessing === false) {
        pendingRef.current = null;
        logger.info('[useStreamingResume] Session not active, clearing marker:', pending);
        onNotActiveRef.current(pending);
      }
    }
    processedCountRef.current = wsMessages.length;
  }, [wsMessages]);
}
