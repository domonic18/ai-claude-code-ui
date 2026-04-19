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
import { useTranslation } from 'react-i18next';
import { FolderOpen, Folder, Check, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import QuickActions from './QuickActions';
import SessionList from './SessionList';
import type { ProjectCardProps } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';

/**
 * DesktopProjectInfo Component
 *
 * Displays project information including folder icon, name, and path.
 * Handles both editing and view modes.
 */
interface DesktopProjectInfoProps {
  isExpanded: boolean;
  isEditing: boolean;
  editingName: string;
  project: { displayName: string; fullPath: string; name: string };
  sessionCount: number;
  hasMoreSessions: boolean;
  onSetEditingName: (name: string) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

function DesktopProjectInfo({
  isExpanded,
  isEditing,
  editingName,
  project,
  sessionCount,
  hasMoreSessions,
  onSetEditingName,
  handleKeyDown,
}: DesktopProjectInfoProps) {
  const { t } = useTranslation();

  return (
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
              placeholder={t('sidebar.projectName')}
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
  );
}

/**
 * DesktopProjectActions Component
 *
 * Displays action buttons for the project card.
 * Shows edit controls (save/cancel) or quick actions based on edit state.
 */
interface DesktopProjectActionsProps {
  isEditing: boolean;
  editingName: string;
  isStarred: boolean;
  sessionCount: number;
  onSaveName: (name: string) => void;
  onCancelEdit: () => void;
  onToggleStar: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
}

function DesktopProjectActions({
  isEditing,
  editingName,
  isStarred,
  sessionCount,
  onSaveName,
  onCancelEdit,
  onToggleStar,
  onStartEdit,
  onDelete,
  onToggleExpand,
  isExpanded,
}: DesktopProjectActionsProps) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
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
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
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
    </div>
  );
}

/**
 * DesktopSessionList Component
 *
 * Displays the session list when the project is expanded.
 */
interface DesktopSessionListProps {
  projectName: string;
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
}

function DesktopSessionList({
  projectName,
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
}: DesktopSessionListProps) {
  return (
    <div className="hidden md:block ml-3 space-y-1 border-l border-border pl-3">
      <SessionList
        projectName={projectName}
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
 * ProjectCardDesktop Component
 */
export const ProjectCardDesktop = memo(function ProjectCardDesktop(props: ProjectCardProps & {
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
    if (e.key === 'Enter') props.onSaveName(props.editingName);
    else if (e.key === 'Escape') props.onCancelEdit();
  };

  const sessionListProps = {
    projectName: props.project.name, sessions: props.sessions,
    cursorSessions: props.cursorSessions, codexSessions: props.codexSessions,
    selectedSessionId: props.selectedSessionId, currentTime: props.currentTime,
    isLoadingSessions: props.isLoadingSessions, initialSessionsLoaded: props.initialSessionsLoaded,
    hasMoreSessions: props.hasMoreSessions, onSessionClick: props.onSessionClick,
    onSessionDelete: props.onSessionDelete, onSessionRename: props.onSessionRename,
    onLoadMoreSessions: props.onLoadMoreSessions, editingSession: props.editingSession,
    onSetEditingSession: props.onSetEditingSession, editingSessionName: props.editingSessionName,
    onSetEditingSessionName: props.onSetEditingSessionName, onNewSession: props.onNewSession,
  };

  const desktopInfoProps = {
    isExpanded: props.isExpanded, isEditing: props.isEditing,
    editingName: props.editingName, project: props.project,
    sessionCount: props.sessionCount, hasMoreSessions: props.hasMoreSessions,
    onSetEditingName: props.onSetEditingName, handleKeyDown,
  };

  const desktopActionsProps = {
    isEditing: props.isEditing, editingName: props.editingName,
    isStarred: props.isStarred, sessionCount: props.sessionCount,
    onSaveName: props.onSaveName, onCancelEdit: props.onCancelEdit,
    onToggleStar: props.onToggleStar, onStartEdit: props.onStartEdit,
    onDelete: props.onDelete, onToggleExpand: props.onToggleExpand,
    isExpanded: props.isExpanded,
  };

  return (
    <div className="group/project">
      <Button
        variant="ghost"
        className={cn(
          "hidden md:flex w-full justify-between p-2 h-auto font-normal hover:bg-accent/50",
          props.isSelected && "bg-accent text-accent-foreground",
          props.isStarred && !props.isSelected && "bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20"
        )}
        onClick={() => {
          if (props.isSelected === false) props.onSelect();
          props.onToggleExpand();
        }}
      >
        <DesktopProjectInfo {...desktopInfoProps} />
        <DesktopProjectActions {...desktopActionsProps} />
      </Button>
      {props.isExpanded && <DesktopSessionList {...sessionListProps} />}
    </div>
  );
});

export default ProjectCardDesktop;
