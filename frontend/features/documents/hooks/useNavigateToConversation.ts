/**
 * useNavigateToConversation Hook
 *
 * 封装从文档面板跳转到对话的逻辑
 * 使用事件总线，由 App.tsx 订阅并执行实际导航
 */

import { useCallback } from 'react';
import { emitNavigateToConversation } from '../services/documentEvents';

/**
 * 跳转到指定对话（发射事件，由 App 层处理）
 */
export function useNavigateToConversation() {
  const navigateToConversation = useCallback(
    (conversationId: string, messageId?: string) => {
      emitNavigateToConversation(conversationId, messageId);
    },
    []
  );

  return navigateToConversation;
}
