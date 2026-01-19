/**
 * SessionItem Component
 *
 * Individual session item in the session list.
 *
 * Features:
 * - Provider-specific icon (Claude/Cursor/Codex)
 * - Session name with rename on double-click
 * - Time ago display with clock icon
 * - Message count badge
 * - Active status indicator (within 10 minutes)
 * - Delete button (always visible on mobile, hover on desktop)
 * - Edit mode for renaming
 */

import React, { memo, useState, useCallback, useEffect, KeyboardEvent } from 'react';
import { ClaudeLogo, CursorLogo, CodexLogo } from '@/shared/assets/icons';
import { Check, X, Clock } from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import type { SessionItemProps } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';

/**
 * Get the appropriate logo component based on session provider
 */
function getSessionLogo(provider?: string) {
  switch (provider) {
    case 'cursor':
      return CursorLogo;
    case 'codex':
      return CodexLogo;
    default:
      return ClaudeLogo;
  }
}

/**
 * SessionItem Component
 */
export const SessionItem = memo(function SessionItem({
  session,
  isSelected,
  isActive,
  timeAgo,
  onClick,
  onDelete,
  onStartRename,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSave,
  onRenameCancel,
}: SessionItemProps) {
  // Use local value for input to ensure immediate updates
  const [localValue, setLocalValue] = useState(renameValue);

  // Sync local value when renameValue prop changes (e.g., when starting edit mode)
  useEffect(() => {
    setLocalValue(renameValue);
  }, [renameValue]);

  const handleDoubleClick = useCallback(() => {
    if (!isRenaming) {
      onStartRename();
      setLocalValue(session.summary || '');
    }
  }, [isRenaming, onStartRename, session.summary]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onRenameSave();
    } else if (e.key === 'Escape') {
      onRenameCancel();
      setLocalValue(session.summary || '');
    }
  }, [onRenameSave, onRenameCancel, session.summary]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onRenameChange(newValue);
  }, [onRenameChange]);

  // Handle save button click (defined before conditional render)
  const handleSaveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRenameSave();
  }, [onRenameSave]);

  // Handle cancel button click (defined before conditional render)
  const handleCancelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRenameCancel();
    setLocalValue(session.summary || '');
  }, [onRenameCancel, session.summary]);

  const SessionLogo = getSessionLogo(session.__provider);

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50 relative z-10">
        <div className="w-3 h-3 flex-shrink-0">
          <SessionLogo className="w-full h-full" />
        </div>
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/20"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
        <div
          className="w-6 h-6 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center rounded cursor-pointer transition-colors flex-shrink-0"
          onClick={handleSaveClick}
          title="Save"
        >
          <Check className="w-3.5 h-3.5" />
        </div>
        <div
          className="w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center rounded cursor-pointer transition-colors flex-shrink-0"
          onClick={handleCancelClick}
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div
        className={cn(
          "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-accent/50",
          isSelected && "bg-accent text-accent-foreground"
        )}
        onClick={onClick}
        onDoubleClick={handleDoubleClick}
        title={session.summary || 'Untitled session'}
      >
        {/* Session Logo */}
        <div className="w-3 h-3 mt-0.5 flex-shrink-0">
          <SessionLogo className="w-full h-full" />
        </div>

        {/* Session Info */}
        <div className="flex-1 min-w-0">
          {/* Session Name */}
          <div className="text-xs font-medium truncate text-foreground">
            {session.summary || 'Untitled session'}
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-1 mt-0.5">
            {/* Clock Icon */}
            <Clock className="w-2.5 h-2.5 text-muted-foreground" />

            {/* Time Ago */}
            <span className="text-xs text-muted-foreground">
              {timeAgo}
            </span>

            {/* Message Count Badge */}
            {(session.messageCount ?? 0) > 0 && (
              <Badge variant="secondary" className="text-xs px-1 py-0 ml-auto">
                {session.messageCount}
              </Badge>
            )}
          </div>

          {/* Active Indicator */}
          {isActive && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
              Active
            </span>
          )}
        </div>
      </div>

      {/* Hover Action Buttons - Desktop only */}
      <div className="hidden md:block absolute right-2 top-1/2 transform -translate-y-1/2">
        <div className="flex items-center gap-1 invisible group-hover:visible transition-all duration-200">
          {/* Edit Button */}
          <button
            className="w-6 h-6 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/40 rounded flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onStartRename();
              setLocalValue(session.summary || '');
            }}
            title="Manually edit session name"
          >
            <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
            </svg>
          </button>

          {/* Delete Button (only for non-Cursor sessions) */}
          {session.__provider !== 'cursor' && (
            <button
              className="w-6 h-6 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete this session permanently"
            >
              <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Delete Button - Always visible */}
      <div className="md:hidden absolute right-2 top-1/2 transform -translate-y-1/2">
        {session.__provider !== 'cursor' && (
          <button
            className="w-5 h-5 rounded-md bg-red-50 dark:bg-red-900/20 flex items-center justify-center active:scale-95 transition-transform opacity-70"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete this session"
          >
            <svg className="w-2.5 h-2.5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});

export default SessionItem;
