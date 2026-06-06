/**
 * ProjectList Component
 *
 * Container for displaying a grouped list of projects with their sessions.
 *
 * Features:
 * - Project header rows with expand/collapse, new session, and three-dot menu
 * - Session list under each expanded project
 * - Inline project rename editing
 * - Empty project placeholder text
 * - Scrollable area with loading skeletons
 */

import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/shared/components/ui/ScrollArea';
import { formatTimeAgo, getAllSessions } from '../utils/timeFormatters';
import type { ProjectListProps, Project, Session, SessionProvider } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';
import SessionList from './SessionList';
import { SKELETON_COUNT } from '../constants/sidebar.constants';
import { ChevronDown, ChevronRight, Plus, MoreVertical, Edit3, Trash2, Folder } from 'lucide-react';

function useInitialSessionTracking(projects: Project[]): Set<string> {
  const [initialSessionsLoaded, setInitialSessionsLoaded] = useState<Set<string>>(new Set());
  const prevProjectsRef = useRef<Project[]>([]);

  useEffect(() => {
    const prevNames = new Set(prevProjectsRef.current.map(p => p.name));
    const currentNames = new Set(projects.map(p => p.name));

    const hasChanged = projects.length !== prevProjectsRef.current.length ||
                       !projects.every(p => prevNames.has(p.name));

    if (hasChanged) {
      const newLoaded = new Set<string>();
      projects.forEach(project => {
        newLoaded.add(project.name);
      });
      setInitialSessionsLoaded(newLoaded);
      prevProjectsRef.current = projects;
    }
  }, [projects]);

  return initialSessionsLoaded;
}

interface ProjectListItemProps {
  project: Project;
  selectedProject: Project | null;
  selectedSession: Session | null;
  isExpanded: boolean;
  isStarred: boolean;
  isEditing: boolean;
  editingName: string;
  hasMoreSessions: Record<string, boolean | undefined>;
  loadingSessions: Record<string, boolean | undefined>;
  currentTime: Date;
  initialSessionsLoaded: boolean;
  editingSession: Session | null;
  editingSessionName: string;
  onToggleExpand: () => void;
  onSelectProject: (project: Project) => void;
  onStartEditing: (project: Project) => void;
  onCancelEditing: () => void;
  onSaveProjectName: (projectName: string, newName: string) => Promise<void>;
  onSetEditingName: (name: string) => void;
  onToggleStar: (projectName: string) => void;
  onDeleteProject: (projectName: string, displayName: string) => Promise<void>;
  onNewSession: (projectName: string) => void;
  onSessionClick: (session: Session, projectName: string) => void;
  onSessionDelete: (projectName: string, sessionId: string, provider?: SessionProvider) => Promise<void>;
  onSessionRename: (projectName: string, sessionId: string, summary: string) => Promise<void>;
  onLoadMoreSessions: (project: Project) => Promise<void>;
  onSetEditingSession: (session: Session | null) => void;
  onSetEditingSessionName: (name: string) => void;
}

function useClickOutside(containerRef: React.RefObject<HTMLElement>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, containerRef]);
}

const ProjectListItem = memo(function ProjectListItem({
  project,
  selectedProject,
  selectedSession,
  isExpanded,
  isStarred,
  isEditing,
  editingName,
  hasMoreSessions,
  loadingSessions,
  currentTime,
  initialSessionsLoaded,
  editingSession,
  editingSessionName,
  onToggleExpand,
  onSelectProject,
  onStartEditing,
  onCancelEditing,
  onSaveProjectName,
  onSetEditingName,
  onToggleStar,
  onDeleteProject,
  onNewSession,
  onSessionClick,
  onSessionDelete,
  onSessionRename,
  onLoadMoreSessions,
  onSetEditingSession,
  onSetEditingSessionName,
}: ProjectListItemProps) {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const allSessions = getAllSessions(project);
  const sessionCount = allSessions.length;
  const isSelected = selectedProject?.name === project.name;
  const isLoadingSessionsForProject = loadingSessions[project.name];
  const hasMoreSessionsForProject = hasMoreSessions[project.name] !== false;

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useClickOutside(menuRef, isMenuOpen, closeMenu);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveName = useCallback(() => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== project.displayName) {
      onSaveProjectName(project.name, trimmed);
    } else {
      onCancelEditing();
    }
  }, [editingName, project.name, project.displayName, onSaveProjectName, onCancelEditing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEditing();
    }
  }, [handleSaveName, onCancelEditing]);

  const displayName = project.displayName || project.name;

  return (
    <div className={cn(
      'group/project rounded-md',
      isSelected && 'bg-accent/50',
    )}>
      {/* Project header row */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-accent/30 rounded-md transition-colors"
        onClick={() => {
          if (!isEditing) {
            onSelectProject(project);
            if (!isExpanded) onToggleExpand();
          }
        }}
      >
        {/* Expand/collapse arrow */}
        <button
          className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Folder icon */}
        <Folder className={cn(
          'w-3.5 h-3.5 flex-shrink-0',
          isStarred ? 'text-yellow-500' : 'text-muted-foreground',
        )} />

        {/* Project name (editable) */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editingName}
            onChange={(e) => onSetEditingName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 text-sm bg-transparent border-b border-primary outline-none px-0.5"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm font-medium truncate">
            {displayName}
          </span>
        )}

        {/* Session count badge */}
        {sessionCount > 0 && !isEditing && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {sessionCount}
          </span>
        )}

        {/* Action buttons (visible on hover) */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* New session button */}
            <button
              className="w-5 h-5 opacity-0 group-hover/project:opacity-100 transition-opacity hover:bg-accent flex items-center justify-center rounded"
              onClick={(e) => {
                e.stopPropagation();
                onNewSession(project.name);
                if (!isExpanded) onToggleExpand();
              }}
              title={t('sidebar.newSession')}
            >
              <Plus className="w-3 h-3" />
            </button>

            {/* Three-dot menu */}
            <div ref={menuRef} className="relative">
              <button
                className="w-5 h-5 opacity-0 group-hover/project:opacity-100 transition-opacity hover:bg-accent flex items-center justify-center rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen((prev) => !prev);
                }}
                title={t('sidebar.projectActions')}
              >
                <MoreVertical className="w-3 h-3" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
                  <button
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-accent/50 transition-colors text-sm text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onStartEditing(project);
                    }}
                  >
                    <Edit3 className="w-3 h-3" />
                    {t('sidebar.renameProject')}
                  </button>
                  <button
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm text-red-600 dark:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDeleteProject(project.name, displayName);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                    {t('sidebar.deleteProject')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded session list */}
      {isExpanded && (
        <div className="ml-3">
          <SessionList
            projectName={project.name}
            sessions={project.sessions}
            cursorSessions={project.cursorSessions}
            codexSessions={project.codexSessions}
            selectedSessionId={selectedSession?.id}
            currentTime={currentTime}
            isLoadingSessions={isLoadingSessionsForProject}
            initialSessionsLoaded={initialSessionsLoaded}
            hasMoreSessions={hasMoreSessionsForProject}
            onSessionClick={(session: Session) => onSessionClick(session, project.name)}
            onSessionDelete={onSessionDelete}
            onSessionRename={onSessionRename}
            onLoadMoreSessions={() => onLoadMoreSessions(project)}
            editingSession={editingSession}
            onSetEditingSession={onSetEditingSession}
            editingSessionName={editingSessionName}
            onSetEditingSessionName={onSetEditingSessionName}
            onNewSession={() => onNewSession(project.name)}
          />
        </div>
      )}
    </div>
  );
});

export const ProjectList = memo(function ProjectList({
  projects,
  selectedProject,
  selectedSession,
  expandedProjects,
  starredProjects,
  editingProject,
  editingName,
  loadingSessions,
  hasMoreSessions,
  currentTime,
  isLoading,
  onToggleProject,
  onStartEditing,
  onCancelEditing,
  onSaveProjectName,
  onSetEditingName,
  onToggleStar,
  onDeleteProject,
  onSelectProject,
  onSessionClick,
  onDeleteSession,
  onUpdateSessionSummary,
  onLoadMoreSessions,
  onSetEditingSession,
  onSetEditingSessionName,
  editingSession,
  editingSessionName,
  onNewSession,
}: ProjectListProps) {
  const { t } = useTranslation();
  const initialSessionsLoaded = useInitialSessionTracking(projects);

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-0 p-2">
        {isLoading ? (
          Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="p-2 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-muted rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : projects.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">{t('sidebar.noProjectsFound')}</p>
          </div>
        ) : (
          projects.map((project) => (
            <ProjectListItem
              key={project.name}
              project={project}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              isExpanded={expandedProjects.has(project.name)}
              isStarred={starredProjects.has(project.name)}
              isEditing={editingProject === project.name}
              editingName={editingName}
              hasMoreSessions={hasMoreSessions}
              loadingSessions={loadingSessions}
              currentTime={currentTime}
              initialSessionsLoaded={initialSessionsLoaded.has(project.name)}
              editingSession={editingSession}
              editingSessionName={editingSessionName}
              onToggleExpand={() => onToggleProject(project.name)}
              onSelectProject={onSelectProject}
              onStartEditing={onStartEditing}
              onCancelEditing={onCancelEditing}
              onSaveProjectName={onSaveProjectName}
              onSetEditingName={onSetEditingName}
              onToggleStar={onToggleStar}
              onDeleteProject={(name, dispName) => onDeleteProject(name, dispName)}
              onNewSession={onNewSession}
              onSessionClick={onSessionClick}
              onSessionDelete={onDeleteSession}
              onSessionRename={onUpdateSessionSummary}
              onLoadMoreSessions={onLoadMoreSessions}
              onSetEditingSession={onSetEditingSession}
              onSetEditingSessionName={onSetEditingSessionName}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
});

export default ProjectList;
