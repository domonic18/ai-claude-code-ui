/**
 * useChatInputMenus Hook
 *
 * Manages menu positioning for command and file reference menus.
 */

import { useMenuPosition } from './useMenuPosition';
import type { RefObject } from 'react';

interface UseChatInputMenusOptions {
  /** Textarea ref */
  textareaRef: RefObject<HTMLTextAreaElement>;
  /** Command menu open state */
  commandMenuOpen: boolean;
  /** File menu open state */
  fileMenuOpen: boolean;
}

interface MenuPositions {
  /** Command menu position */
  commandMenuPosition: { top: number; left: number };
  /** File menu position */
  fileMenuPosition: { top: number; left: number };
}

// 由组件调用，自定义 Hook：useChatInputMenus
/**
 * Hook for managing menu positions in ChatInput
 */
export function useChatInputMenus({
  textareaRef,
  commandMenuOpen,
  fileMenuOpen,
}: UseChatInputMenusOptions): MenuPositions {
  // Use menu position hook for command menu
  const commandMenuPosition = useMenuPosition(
    textareaRef,
    commandMenuOpen,
    { menuHeight: 300, offset: 0 }
  );

  // Use menu position hook for file menu
  const fileMenuPosition = useMenuPosition(
    textareaRef,
    fileMenuOpen,
    { menuHeight: 300, offset: 0 }
  );

  return {
    commandMenuPosition,
    fileMenuPosition,
  };
}
