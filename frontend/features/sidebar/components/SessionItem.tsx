/**
 * SessionItem Component
 *
 * Individual session item in the session list.
 *
 * Features:
 * - Provider-specific icon (Claude/Cursor/Codex)
 * - Session name with rename on double-click
 * - Time ago display
 * - Active status indicator (within 10 minutes)
 * - Delete button
 * - Edit mode for renaming
 */

import React, { memo, useState, useCallback, KeyboardEvent } from 'react';
import ClaudeLogo from '../../../components/ClaudeLogo';
import CursorLogo from '../../../components/CursorLogo';
import CodexLogo from '../../../components/CodexLogo';
import { Check, X } from 'lucide-react';
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
  const [localValue, setLocalValue] = useState(renameValue);

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

  const SessionLogo = getSessionLogo(session.__provider);

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50">
        <div className="w-3 h-3">
          <SessionLogo className="w-full h-full" />
        </div>
        <input
          type="text"
          value={renameValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/20"
          autoFocus
        />
        <div
          className="w-5 h-5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center rounded cursor-pointer transition-colors"
          onClick={onRenameSave}
        >
          <Check className="w-3 h-3" />
        </div>
        <div
          className="w-5 h-5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center rounded cursor-pointer transition-colors"
          onClick={() => {
            onRenameCancel();
            setLocalValue(session.summary || '');
          }}
        >
          <X className="w-3 h-3" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
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
        <div className="text-sm truncate text-foreground">
          {session.summary || 'Untitled session'}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timeAgo}</span>
          {isActive && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
              Active
            </span>
          )}
        </div>
      </div>

      {/* Delete Button */}
      <div
        className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center rounded cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete session"
      >
        <svg
          className="w-3 h-3 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </div>
    </div>
  );
});

export default SessionItem;
