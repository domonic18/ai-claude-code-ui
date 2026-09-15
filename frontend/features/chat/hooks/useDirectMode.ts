/**
 * useDirectMode Hook
 *
 * 直连模式状态管理：会话归属属性，不是运行时开关。
 * - 新建会话时由侧栏 + 号二选一写入（direct-mode localStorage key）
 * - 选中历史会话时按其 provider 对齐（直连会话→true，其他→false）
 * 独立 key（DIRECT_MODE），不与 selected-provider 冲突
 * （后者已被模型厂商值与会话 provider 值双向共用）。
 */

import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

/** 读取持久化的直连模式标记（异常容错返回 false）。供新建会话场景读取二选一结果 */
export function readStoredDirectModeFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.DIRECT_MODE) === 'true';
  } catch {
    return false;
  }
}

export interface UseDirectModeResult {
  /** 直连模式是否开启（当前会话归属） */
  isDirectMode: boolean;
  /** 显式设置直连模式（会话切换/新建时由 useChatInterface 联动调用） */
  setDirectMode: (enabled: boolean) => void;
}

/**
 * Hook for direct mode state (session-scoped, not a runtime toggle)
 *
 * @param initial - 初始值（默认从 localStorage 恢复）
 * @returns Direct mode state and setter
 */
export function useDirectMode(initial?: boolean): UseDirectModeResult {
  const [isDirectMode, setIsDirectMode] = useState<boolean>(
    initial ?? readStoredDirectModeFlag()
  );

  const setDirectMode = useCallback((enabled: boolean) => {
    setIsDirectMode(enabled);
    try {
      if (enabled) localStorage.setItem(STORAGE_KEYS.DIRECT_MODE, 'true');
      else localStorage.removeItem(STORAGE_KEYS.DIRECT_MODE);
    } catch {
      // localStorage 不可用（隐私模式等）时仅保留内存态
    }
  }, []);

  return { isDirectMode, setDirectMode };
}

export default useDirectMode;
