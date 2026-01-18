/**
 * QuickActions Component
 *
 * Quick action buttons for project cards (star, edit, delete, expand).
 *
 * Features:
 * - Star/unstar project
 * - Rename project
 * - Delete project (optional)
 * - Toggle expand/collapse
 * - Responsive hover/touch visibility
 */

import React, { memo } from 'react';
import { Star, Edit3, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QuickActionsProps } from '../types/sidebar.types';

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

      {/* Edit button */}
      <div
        className="w-6 h-6 opacity-0 group-hover/project:opacity-100 transition-all duration-200 hover:bg-accent flex items-center justify-center rounded cursor-pointer touch:opacity-100"
        onClick={onStartEdit}
        title={t('sidebar.renameProject')}
      >
        <Edit3 className="w-3 h-3" />
      </div>

      {/* Delete button (optional) */}
      {onDelete && (
        <div
          className="w-6 h-6 opacity-0 group-hover/project:opacity-100 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center rounded cursor-pointer touch:opacity-100"
          onClick={onDelete}
          title={t('sidebar.deleteEmptyProject')}
        >
          <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
        </div>
      )}

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
