/**
 * useDirectMode Hook
 *
 * 直连模式开关状态管理：跳过 Agent SDK，直接调用所选模型 API。
 * 独立 localStorage key（DIRECT_MODE）持久化，不与 selected-provider 冲突
 * （后者已被模型厂商值与会话 provider 值双向共用）。
 */

import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

/** 读取持久化的直连模式开关（异常容错返回 false） */
function readStoredDirectMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.DIRECT_MODE) === 'true';
  } catch {
    return false;
  }
}

export interface UseDirectModeResult {
  /** 直连模式是否开启 */
  isDirectMode: boolean;
  /** 切换直连模式 */
  toggleDirectMode: () => void;
  /** 显式设置直连模式（选中直连会话时联动用） */
  setDirectMode: (enabled: boolean) => void;
}

/**
 * Hook for direct model mode state
 *
 * @param initial - 初始值（默认从 localStorage 恢复）
 * @returns Direct mode state and handlers
 */
export function useDirectMode(initial?: boolean): UseDirectModeResult {
  const [isDirectMode, setIsDirectMode] = useState<boolean>(
    initial ?? readStoredDirectMode()
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

  const toggleDirectMode = useCallback(() => {
    setDirectMode(!isDirectMode);
  }, [isDirectMode, setDirectMode]);

  return { isDirectMode, toggleDirectMode, setDirectMode };
}

export default useDirectMode;
