import { useEffect, useRef } from 'react';

/**
 * Custom hook for command menu effects
 * Handles click-outside and scroll-into-view behavior
 */
export function useCommandMenuEffects(
  menuRef: React.RefObject<HTMLDivElement>,
  selectedItemRef: React.RefObject<HTMLDivElement>,
  isOpen: boolean,
  selectedIndex: number,
  onClose?: () => void
) {
  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && isOpen) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const itemRect = selectedItemRef.current.getBoundingClientRect();
      const isOutOfBounds = itemRect.bottom > menuRect.bottom || itemRect.top < menuRect.top;

      if (isOutOfBounds) {
        selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);
}
