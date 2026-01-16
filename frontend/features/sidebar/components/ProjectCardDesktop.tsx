/**
 * ProjectCardDesktop Component
 *
 * Desktop version of the project card component.
 *
 * Features:
 * - Folder icon (open/closed based on expand state)
 * - Project display name and path
 * - Session count display
 * - Star indicator
 * - Edit mode for renaming
 * - Quick action buttons on hover
 */

import React, { memo, KeyboardEvent } from 'react';
import { FolderOpen, Folder, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import QuickActions from './QuickActions';
import SessionList from './SessionList';
import type { ProjectCardProps } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';

/**
 * ProjectCardDesktop Component
 */
export const ProjectCardDesktop = memo(function ProjectCardDesktop({
  project,
  isSelected,
  isStarred,
  isExpanded,
  isEditing,
  editingName,
  sessionCount,
  hasMoreSessions,
  onToggleExpand,
  onStartEdit,
  onSetEditingName,
  onCancelEdit,
  onSaveName,
  onToggleStar,
  onDelete,
  onSelect,
  onSessionClick,
  onLoadMoreSessions,
  isLoadingSessions,
  isRenaming,
  onNewSession,
  // Session list props
  projectName,
  sessions,
  cursorSessions,
  codexSessions,
  selectedSessionId,
  currentTime,
  initialSessionsLoaded,
  onSessionDelete,
  onSessionRename,
  editingSession,
  onSetEditingSession,
  editingSessionName,
  onSetEditingSessionName,
}: ProjectCardProps & {
  projectName: string;
  sessions?: any[];
  cursorSessions?: any[];
  codexSessions?: any[];
  selectedSessionId?: string;
  currentTime: Date;
  initialSessionsLoaded: boolean;
  onSessionDelete: any;
  onSessionRename: any;
  editingSession: any;
  onSetEditingSession: any;
  editingSessionName: string;
  onSetEditingSessionName: any;
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSaveName(editingName);
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  return (
    <div className="group">
      {/* Desktop Project Item */}
      <Button
        variant="ghost"
        className={cn(
          "hidden md:flex w-full justify-between p-2 h-auto font-normal hover:bg-accent/50",
          isSelected && "bg-accent text-accent-foreground",
          isStarred && !isSelected && "bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20"
        )}
        onClick={() => {
          if (isSelected === false) {
            onSelect();
          }
          onToggleExpand();
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1 text-left">
            {isEditing ? (
              <div className="space-y-1">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => onSetEditingName(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                  placeholder="Project name"
                  autoFocus
                  onKeyDown={handleKeyDown}
                />
                <div className="text-xs text-muted-foreground truncate" title={project.fullPath}>
                  {project.fullPath}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-semibold truncate text-foreground" title={project.displayName}>
                  {project.displayName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {hasMoreSessions && sessionCount >= 5 ? `${sessionCount}+` : sessionCount}
                  {project.fullPath !== project.displayName && (
                    <span className="ml-1 opacity-60" title={project.fullPath}>
                      • {project.fullPath.length > 25 ? '...' + project.fullPath.slice(-22) : project.fullPath}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isEditing ? (
            <>
              <div
                className="w-6 h-6 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center rounded cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveName(editingName);
                }}
              >
                <Check className="w-3 h-3" />
              </div>
              <div
                className="w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center rounded cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEdit();
                }}
              >
                <X className="w-3 h-3" />
              </div>
            </>
          ) : (
            <QuickActions
              isStarred={isStarred}
              showActions={true}
              onToggleStar={(e) => {
                e.stopPropagation();
                onToggleStar();
              }}
              onStartEdit={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              onDelete={sessionCount === 0 ? (e) => {
                e.stopPropagation();
                onDelete();
              } : undefined}
              onToggleExpand={onToggleExpand}
              isExpanded={isExpanded}
            />
          )}
        </div>
      </Button>

      {/* Sessions List */}
      {isExpanded && (
        <div className="hidden md:block ml-3 space-y-1 border-l border-border pl-3">
          <SessionList
            projectName={project.name}
            sessions={sessions}
            cursorSessions={cursorSessions}
            codexSessions={codexSessions}
            selectedSessionId={selectedSessionId}
            currentTime={currentTime}
            isLoadingSessions={isLoadingSessions}
            initialSessionsLoaded={initialSessionsLoaded}
            hasMoreSessions={hasMoreSessions}
            onSessionClick={onSessionClick}
            onSessionDelete={onSessionDelete}
            onSessionRename={onSessionRename}
            onLoadMoreSessions={onLoadMoreSessions}
            editingSession={editingSession}
            onSetEditingSession={onSetEditingSession}
            editingSessionName={editingSessionName}
            onSetEditingSessionName={onSetEditingSessionName}
            onNewSession={onNewSession}
          />
        </div>
      )}
    </div>
  );
});

export default ProjectCardDesktop;
