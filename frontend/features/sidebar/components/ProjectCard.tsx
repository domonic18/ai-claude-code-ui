/**
 * ProjectCard Component
 *
 * Mobile version of the project card component.
 *
 * Features:
 * - Compact layout for mobile view
 * - Folder icon (open/closed based on expand state)
 * - Project display name and path
 * - Session count display
 * - Star indicator
 * - Edit mode for renaming
 * - Quick action buttons (always visible on mobile)
 * - Swipe-friendly touch handling
 */

import React, { memo, KeyboardEvent, useState, useEffect } from 'react';
import { FolderOpen, Folder, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import QuickActions from './QuickActions';
import SessionList from './SessionList';
import type { ProjectCardProps } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';

/**
 * ProjectCard Component (Mobile)
 */
export const ProjectCard = memo(function ProjectCard({
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
      {/* Mobile Project Item */}
      <div
        className={cn(
          "flex md:hidden items-center gap-3 p-3 border-b border-border",
          isSelected && "bg-accent text-accent-foreground",
          isStarred && !isSelected && "bg-yellow-50/50 dark:bg-yellow-900/10"
        )}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={() => {
            if (isSelected === false) {
              onSelect();
            }
            onToggleExpand();
          }}
          className="flex-shrink-0"
        >
          {isExpanded ? (
            <FolderOpen className="w-5 h-5 text-primary" />
          ) : (
            <Folder className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {/* Project Info */}
        <div
          className="flex-1 min-w-0"
          onClick={() => {
            if (isSelected === false) {
              onSelect();
            }
            onToggleExpand();
          }}
        >
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

        {/* Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isEditing ? (
            <>
              <div
                className="w-8 h-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center rounded cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveName(editingName);
                }}
              >
                <Check className="w-4 h-4" />
              </div>
              <div
                className="w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center rounded cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEdit();
                }}
              >
                <X className="w-4 h-4" />
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
              onToggleExpand={() => {}}
              isExpanded={isExpanded}
            />
          )}
        </div>
      </div>

      {/* Sessions List */}
      {isExpanded && (
        <div className="md:hidden ml-3 space-y-1 border-l border-border pl-3">
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

export default ProjectCard;
