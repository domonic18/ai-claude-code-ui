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
      </div>

      {/* Hover Action Buttons */}
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
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
      </div>
    </div>
  );
});

export default SessionItem;
