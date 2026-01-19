/**
 * ProjectList Component
 *
 * Container for displaying a list of sessions (without project folders).
 *
 * Features:
 * - Scrollable area for session list
 * - Displays all sessions from all projects in a flat list
 * - Manages session loading and pagination
 */

import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/shared/components/ui/ScrollArea';
import { formatTimeAgo, getAllSessions } from '../utils/timeFormatters';
import type { ProjectListProps, Project, Session, SessionProvider } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';
import SessionList from './SessionList';
import { SKELETON_COUNT } from '../constants/sidebar.constants';

/**
 * ProjectList Component
 */
export const ProjectList = memo(function ProjectList({
  projects,
  selectedProject,
  selectedSession,
  expandedProjects,
  starredProjects,
  editingProject,
  editingName,
  loadingSessions,
  additionalSessions,
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

  // Track initial sessions loaded state per project
  const [initialSessionsLoaded, setInitialSessionsLoaded] = useState<Set<string>>(new Set());

  // Use ref to track previous projects for deep comparison
  const prevProjectsRef = useRef<Project[]>([]);

  // Mark all projects as loaded when they come in (regardless of whether they have sessions)
  useEffect(() => {
    // Check if projects have actually changed by comparing project names
    const prevNames = new Set(prevProjectsRef.current.map(p => p.name));
    const currentNames = new Set(projects.map(p => p.name));

    const hasChanged = projects.length !== prevProjectsRef.current.length ||
                       !projects.every(p => prevNames.has(p.name));

    if (hasChanged) {
      const newLoaded = new Set<string>();
      projects.forEach(project => {
        // All projects should be marked as loaded when we receive them
        // The sessions data (even if empty) has been loaded from the server
        newLoaded.add(project.name);
      });
      setInitialSessionsLoaded(newLoaded);
      prevProjectsRef.current = projects;
    }
  }, [projects]);

  const handleSaveProjectName = useCallback(async (projectName: string, newName: string) => {
    await onSaveProjectName(projectName, newName);
  }, [onSaveProjectName]);

  const handleToggleStar = useCallback((projectName: string) => {
    onToggleStar(projectName);
  }, [onToggleStar]);

  const handleDeleteProject = useCallback((projectName: string) => {
    onDeleteProject(projectName);
  }, [onDeleteProject]);

  const handleSelectProject = useCallback((project: Project) => {
    onSelectProject(project);
  }, [onSelectProject]);

  const handleSessionClick = useCallback((session: Session, projectName: string) => {
    onSessionClick(session, projectName);
  }, [onSessionClick]);

  const handleSessionDelete = useCallback(async (projectName: string, sessionId: string, provider?: SessionProvider) => {
    await onDeleteSession(projectName, sessionId, provider);
  }, [onDeleteSession]);

  const handleSessionRename = useCallback(async (projectName: string, sessionId: string, summary: string) => {
    await onUpdateSessionSummary(projectName, sessionId, summary);
  }, [onUpdateSessionSummary]);

  const handleLoadMoreSessions = useCallback(async (project: Project) => {
    await onLoadMoreSessions(project);
  }, [onLoadMoreSessions]);

  const handleNewSession = useCallback((projectName: string) => {
    if (onNewSession) {
      onNewSession(projectName);
    }
  }, [onNewSession]);

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-0 p-2">
        {isLoading ? (
          // Loading skeleton
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
          // Display all sessions from all projects in a flat list
          projects.map((project) => {
            const allSessions = getAllSessions(project);
            const hasMoreSessions = project.sessionMeta?.hasMore !== false;
            const isLoadingSessionsForProject = loadingSessions[project.name];

            // Skip projects with no sessions
            if (allSessions.length === 0 && !isLoadingSessionsForProject) {
              return null;
            }

            return (
              <SessionList
                key={project.name}
                projectName={project.name}
                sessions={project.sessions}
                cursorSessions={project.cursorSessions}
                codexSessions={project.codexSessions}
                selectedSessionId={selectedSession?.id}
                currentTime={currentTime}
                isLoadingSessions={isLoadingSessionsForProject}
                initialSessionsLoaded={initialSessionsLoaded.has(project.name)}
                hasMoreSessions={hasMoreSessions}
                onSessionClick={(session: Session) => handleSessionClick(session, project.name)}
                onSessionDelete={(projectName: string, sessionId: string, provider?: SessionProvider) =>
                  handleSessionDelete(projectName, sessionId, provider)}
                onSessionRename={(projectName: string, sessionId: string, summary: string) =>
                  handleSessionRename(projectName, sessionId, summary)}
                onLoadMoreSessions={() => handleLoadMoreSessions(project)}
                editingSession={editingSession}
                onSetEditingSession={onSetEditingSession}
                editingSessionName={editingSessionName}
                onSetEditingSessionName={onSetEditingSessionName}
                onNewSession={() => handleNewSession(project.name)}
              />
            );
          })
        )}
      </div>
    </ScrollArea>
  );
});

export default ProjectList;
