/**
 * QuickActions Component
 *
 * Quick action buttons for project cards (star, three-dot menu, expand).
 *
 * Features:
 * - Star/unstar project
 * - Three-dot menu with rename and delete options
 * - Delete always available (regardless of session count)
 * - Toggle expand/collapse
 * - Responsive hover/touch visibility
 * - Click-outside to close menu
 */

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Star, MoreVertical, Edit3, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QuickActionsProps } from '../types/sidebar.types';

function useClickOutside(containerRef: React.RefObject<HTMLElement>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, containerRef]);
}

/**
 * QuickActions Component
 */
export const QuickActions = memo(function QuickActions({
  isStarred,
  showActions,
  onToggleStar,
  onStartEdit,
  onDelete,
  onToggleExpand,
  isExpanded,
}: QuickActionsProps) {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  useClickOutside(menuRef, isMenuOpen, closeMenu);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onStartEdit(e);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onDelete(e);
  };

  return (
    <>
      {/* Star button - always visible when starred, otherwise on hover */}
      <div
        className={`w-6 h-6 transition-all duration-200 flex items-center justify-center rounded cursor-pointer touch:opacity-100 ${
          isStarred
            ? 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20 opacity-100'
            : 'opacity-0 group-hover/project:opacity-100 hover:bg-accent'
        }`}
        onClick={onToggleStar}
        title={isStarred ? t('sidebar.removeFromFavorites') : t('sidebar.addToFavorites')}
      >
        <Star
          className={`w-3 h-3 transition-colors ${
            isStarred
              ? 'text-yellow-600 dark:text-yellow-400 fill-current'
              : 'text-muted-foreground'
          }`}
        />
      </div>

      {/* Three-dot menu */}
      <div ref={menuRef} className="relative">
        <div
          className="w-6 h-6 opacity-0 group-hover/project:opacity-100 transition-all duration-200 hover:bg-accent flex items-center justify-center rounded cursor-pointer touch:opacity-100"
          onClick={handleMenuToggle}
          title={t('sidebar.projectActions')}
        >
          <MoreVertical className="w-3 h-3" />
        </div>

        {/* Dropdown menu */}
        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
            <button
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-accent/50 transition-colors text-sm text-foreground"
              onClick={handleRename}
            >
              <Edit3 className="w-3 h-3" />
              {t('sidebar.renameProject')}
            </button>
            <button
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm text-red-600 dark:text-red-400"
              onClick={handleDelete}
            >
              <Trash2 className="w-3 h-3" />
              {t('sidebar.deleteProject')}
            </button>
          </div>
        )}
      </div>

      {/* Expand/Collapse indicator */}
      {isExpanded ? (
        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover/project:text-foreground transition-colors" />
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/project:text-foreground transition-colors" />
      )}
    </>
  );
});

export default QuickActions;
