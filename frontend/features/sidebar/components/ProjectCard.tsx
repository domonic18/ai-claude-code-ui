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

import React, { memo, KeyboardEvent } from 'react';
import { FolderOpen, Folder, Check, X } from 'lucide-react';
import QuickActions from './QuickActions';
import SessionList from './SessionList';
import type { ProjectCardProps } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';

/**
 * ProjectInfo Component
 *
 * Displays project information in mobile view with optional edit mode.
 *
 * @param {Object} props - Component props
 * @param {Object} props.project - Project data
 * @param {boolean} props.isEditing - Whether project is being edited
 * @param {string} props.editingName - Current editing name value
 * @param {number} props.sessionCount - Number of sessions
 * @param {boolean} props.hasMoreSessions - Whether there are more sessions to load
 * @param {Function} props.onSetEditingName - Handler to update editing name
 * @param {Function} props.onToggleExpand - Handler to toggle expand/collapse
 * @param {Function} props.onSelect - Handler to select project
 * @param {Function} props.handleKeyDown - Keyboard handler for edit input
 */
function ProjectInfo({
  project,
  isEditing,
  editingName,
  sessionCount,
  hasMoreSessions,
  onSetEditingName,
  onToggleExpand,
  onSelect,
  handleKeyDown,
}: {
  project: ProjectCardProps['project'];
  isEditing: boolean;
  editingName: string;
  sessionCount: number;
  hasMoreSessions: boolean;
  onSetEditingName: (name: string) => void;
  onToggleExpand: () => void;
  onSelect: () => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      className="flex-1 min-w-0"
      onClick={() => {
        onToggleExpand();
        onSelect();
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
  );
}

/**
 * ProjectActions Component
 *
 * Displays action buttons for editing, saving, canceling, and quick actions.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isEditing - Whether project is being edited
 * @param {string} props.editingName - Current editing name value
 * @param {boolean} props.isStarred - Whether project is starred
 * @param {boolean} props.isExpanded - Whether project is expanded
 * @param {number} props.sessionCount - Number of sessions
 * @param {Function} props.onSaveName - Handler to save edited name
 * @param {Function} props.onCancelEdit - Handler to cancel editing
 * @param {Function} props.onToggleStar - Handler to toggle star status
 * @param {Function} props.onStartEdit - Handler to start editing
 * @param {Function} props.onDelete - Handler to delete project
 */
function ProjectActions({
  isEditing,
  editingName,
  isStarred,
  isExpanded,
  sessionCount,
  onSaveName,
  onCancelEdit,
  onToggleStar,
  onStartEdit,
  onDelete,
}: {
  isEditing: boolean;
  editingName: string;
  isStarred: boolean;
  isExpanded: boolean;
  sessionCount: number;
  onSaveName: (name: string) => void;
  onCancelEdit: () => void;
  onToggleStar: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  return (
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
  );
}

/**
 * MobileProjectItem Component Props
 *
 * Props for the mobile version of the project item with expand button, project info, and actions.
 */
interface MobileProjectItemProps {
  isSelected: boolean;
  isStarred: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  editingName: string;
  sessionCount: number;
  hasMoreSessions: boolean;
  handleExpandToggle: () => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  project: ProjectCardProps['project'];
  onSetEditingName: (name: string) => void;
  onToggleExpand: () => void;
  onSelect: () => void;
  onSaveName: (name: string) => void;
  onCancelEdit: () => void;
  onToggleStar: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}

/**
 * MobileProjectItem Component
 *
 * Mobile version of the project item with expand button, project info, and actions.
 */
function MobileProjectItem({
  isSelected,
  isStarred,
  isExpanded,
  isEditing,
  editingName,
  sessionCount,
  hasMoreSessions,
  handleExpandToggle,
  handleKeyDown,
  project,
  onSetEditingName,
  onToggleExpand,
  onSelect,
  onSaveName,
  onCancelEdit,
  onToggleStar,
  onStartEdit,
  onDelete,
}: MobileProjectItemProps) {
  return (
    <div
      className={cn(
        "flex md:hidden items-center gap-3 p-3 border-b border-border",
        isSelected && "bg-accent text-accent-foreground",
        isStarred && !isSelected && "bg-yellow-50/50 dark:bg-yellow-900/10"
      )}
    >
      {/* Expand/Collapse Button */}
      <button
        onClick={handleExpandToggle}
        className="flex-shrink-0"
      >
        {isExpanded ? (
          <FolderOpen className="w-5 h-5 text-primary" />
        ) : (
          <Folder className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Project Info */}
      <ProjectInfo
        project={project}
        isEditing={isEditing}
        editingName={editingName}
        sessionCount={sessionCount}
        hasMoreSessions={hasMoreSessions}
        onSetEditingName={onSetEditingName}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
        handleKeyDown={handleKeyDown}
      />

      {/* Action Buttons */}
      <ProjectActions
        isEditing={isEditing}
        editingName={editingName}
        isStarred={isStarred}
        isExpanded={isExpanded}
        sessionCount={sessionCount}
        onSaveName={onSaveName}
        onCancelEdit={onCancelEdit}
        onToggleStar={onToggleStar}
        onStartEdit={onStartEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

/**
 * ProjectSessionList Component
 *
 * Wrapper for SessionList with conditional rendering and container styling.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isExpanded - Whether project is expanded (controls visibility)
 * @param {Object} props.project - Project data
 * @param {Array} props.sessions - Session list
 * @param {Array} props.cursorSessions - Cursor session list
 * @param {Array} props.codexSessions - Codex session list
 * @param {string} props.selectedSessionId - Selected session ID
 * @param {Date} props.currentTime - Current time for display
 * @param {boolean} props.isLoadingSessions - Whether sessions are loading
 * @param {boolean} props.initialSessionsLoaded - Whether initial sessions loaded
 * @param {boolean} props.hasMoreSessions - Whether there are more sessions
 * @param {Function} props.onSessionClick - Handler for session click
 * @param {Function} props.onSessionDelete - Handler for session delete
 * @param {Function} props.onSessionRename - Handler for session rename
 * @param {Function} props.onLoadMoreSessions - Handler to load more sessions
 * @param {Object} props.editingSession - Currently editing session
 * @param {Function} props.onSetEditingSession - Handler to set editing session
 * @param {string} props.editingSessionName - Current editing session name
 * @param {Function} props.onSetEditingSessionName - Handler to set editing session name
 * @param {Function} props.onNewSession - Handler to create new session
 */
function ProjectSessionList({
  isExpanded,
  project,
  sessions,
  cursorSessions,
  codexSessions,
  selectedSessionId,
  currentTime,
  isLoadingSessions,
  initialSessionsLoaded,
  hasMoreSessions,
  onSessionClick,
  onSessionDelete,
  onSessionRename,
  onLoadMoreSessions,
  editingSession,
  onSetEditingSession,
  editingSessionName,
  onSetEditingSessionName,
  onNewSession,
}: {
  isExpanded: boolean;
  project: ProjectCardProps['project'];
  sessions?: any[];
  cursorSessions?: any[];
  codexSessions?: any[];
  selectedSessionId?: string;
  currentTime: Date;
  isLoadingSessions: boolean;
  initialSessionsLoaded: boolean;
  hasMoreSessions: boolean;
  onSessionClick: any;
  onSessionDelete: any;
  onSessionRename: any;
  onLoadMoreSessions: any;
  editingSession: any;
  onSetEditingSession: any;
  editingSessionName: string;
  onSetEditingSessionName: any;
  onNewSession: any;
}) {
  if (!isExpanded) {
    return null;
  }

  return (
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
  );
}

/**
 * ProjectCard Component (Mobile)
 */
export const ProjectCard = memo(function ProjectCard(props: ProjectCardProps & {
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
    if (e.key === 'Enter') props.onSaveName(props.editingName);
    else if (e.key === 'Escape') props.onCancelEdit();
  };

  const handleExpandToggle = () => {
    if (props.isSelected === false) props.onSelect();
    props.onToggleExpand();
  };

  return (
    <div className="group/project">
      <MobileProjectItem
        isSelected={props.isSelected} isStarred={props.isStarred} isExpanded={props.isExpanded}
        isEditing={props.isEditing} editingName={props.editingName} sessionCount={props.sessionCount}
        hasMoreSessions={props.hasMoreSessions} handleExpandToggle={handleExpandToggle} handleKeyDown={handleKeyDown}
        project={props.project} onSetEditingName={props.onSetEditingName} onToggleExpand={props.onToggleExpand}
        onSelect={props.onSelect} onSaveName={props.onSaveName} onCancelEdit={props.onCancelEdit}
        onToggleStar={props.onToggleStar} onStartEdit={props.onStartEdit} onDelete={props.onDelete}
      />
      <ProjectSessionList
        isExpanded={props.isExpanded} project={props.project} sessions={props.sessions}
        cursorSessions={props.cursorSessions} codexSessions={props.codexSessions}
        selectedSessionId={props.selectedSessionId} currentTime={props.currentTime}
        isLoadingSessions={props.isLoadingSessions} initialSessionsLoaded={props.initialSessionsLoaded}
        hasMoreSessions={props.hasMoreSessions} onSessionClick={props.onSessionClick}
        onSessionDelete={props.onSessionDelete} onSessionRename={props.onSessionRename}
        onLoadMoreSessions={props.onLoadMoreSessions} editingSession={props.editingSession}
        onSetEditingSession={props.onSetEditingSession} editingSessionName={props.editingSessionName}
        onSetEditingSessionName={props.onSetEditingSessionName} onNewSession={props.onNewSession}
      />
    </div>
  );
});

export default ProjectCard;
