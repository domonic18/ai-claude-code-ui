/**
 * useMenuPosition Hook
 *
 * Calculates menu position relative to an anchor element.
 */

import { useMemo, RefObject } from 'react';

export interface MenuPosition {
  top: number;
  left: number;
  bottom?: number;
  right?: number;
}

export interface UseMenuPositionOptions {
  /** Menu height in pixels for responsive positioning */
  menuHeight?: number;
  /** Offset from anchor in pixels */
  offset?: number;
}

/**
 * Hook for calculating menu position
 *
 * @param anchorRef - Reference to anchor element (textarea/input)
 * @param isOpen - Whether menu is open
 * @param options - Positioning options
 * @returns Menu position object
 */
export function useMenuPosition(
  anchorRef: RefObject<HTMLElement>,
  isOpen: boolean,
  options: UseMenuPositionOptions = {}
): MenuPosition {
  const { menuHeight = 300, offset = 0 } = options;

  const getPosition = useMemo((): MenuPosition => {
    if (!anchorRef.current || !isOpen) {
      return { top: 0, left: 0, bottom: 0 };
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const viewportHeight = window.innerHeight;

    if (isMobile) {
      // Mobile: position menu above the anchor
      return {
        top: 0,
        bottom: window.innerHeight - rect.top + offset,
        left: 16,
        right: 16,
      };
    }

    // Desktop: position menu above or below based on available space
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;

    if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
      // Position below
      return {
        top: rect.bottom + offset,
        left: rect.left,
      };
    } else {
      // Position above
      return {
        top: Math.max(16, rect.top - menuHeight - offset),
        left: rect.left,
      };
    }
  }, [anchorRef, isOpen, menuHeight, offset]);

  return getPosition;
}

export default useMenuPosition;
