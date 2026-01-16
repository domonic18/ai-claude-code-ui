/**
 * ProjectList Component
 *
 * Container for displaying a list of projects with their sessions.
 *
 * Features:
 * - Scrollable area for project list
 * - Renders both mobile and desktop project cards
 * - Handles project selection and expansion
 * - Manages session loading and pagination
 */

import React, { memo, useCallback, useState, useEffect } from 'react';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { formatTimeAgo, getAllSessions } from '../utils/timeFormatters';
import type { ProjectListProps, Project, Session, SessionProvider } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';
import ProjectCard from './ProjectCard';
import ProjectCardDesktop from './ProjectCardDesktop';
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
  // Track initial sessions loaded state per project
  const [initialSessionsLoaded, setInitialSessionsLoaded] = useState<Set<string>>(new Set());

  // Mark all projects as loaded when they come in (regardless of whether they have sessions)
  useEffect(() => {
    const newLoaded = new Set<string>();
    projects.forEach(project => {
      // All projects should be marked as loaded when we receive them
      // The sessions data (even if empty) has been loaded from the server
      newLoaded.add(project.name);
    });
    setInitialSessionsLoaded(newLoaded);
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
                <div className="w-4 h-4 bg-muted rounded animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : projects.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">No projects found</p>
          </div>
        ) : (
          projects.map((project) => {
            const isExpanded = expandedProjects.has(project.name);
            const isStarred = starredProjects.has(project.name);
            const isEditing = editingProject === project.name;
            const isSelected = selectedProject?.name === project.name;
            const allSessions = getAllSessions(project);
            const sessionCount = allSessions.length;
            const hasMoreSessions = project.sessionMeta?.hasMore !== false;
            const isLoadingSessionsForProject = loadingSessions[project.name];

            // Common props for both card versions
            const commonCardProps = {
              project,
              isSelected,
              isStarred,
              isExpanded,
              isEditing,
              editingName,
              sessionCount,
              hasMoreSessions,
              onToggleExpand: () => onToggleProject(project.name),
              onStartEdit: () => onStartEditing(project),
              onCancelEdit: onCancelEditing,
              onSetEditingName: onSetEditingName,
              onSaveName: (newName: string) => handleSaveProjectName(project.name, newName),
              onToggleStar: () => handleToggleStar(project.name),
              onDelete: () => handleDeleteProject(project.name),
              onSelect: () => handleSelectProject(project),
              // Session props
              projectName: project.name,
              sessions: project.sessions,
              cursorSessions: project.cursorSessions,
              codexSessions: project.codexSessions,
              selectedSessionId: selectedSession?.id,
              currentTime,
              isLoadingSessions: isLoadingSessionsForProject,
              initialSessionsLoaded: initialSessionsLoaded.has(project.name),
              onSessionClick: (session: Session) => handleSessionClick(session, project.name),
              onSessionDelete: (projectName: string, sessionId: string, provider?: SessionProvider) =>
                handleSessionDelete(projectName, sessionId, provider),
              onSessionRename: (projectName: string, sessionId: string, summary: string) =>
                handleSessionRename(projectName, sessionId, summary),
              onLoadMoreSessions: () => handleLoadMoreSessions(project),
              editingSession,
              onSetEditingSession,
              editingSessionName,
              onSetEditingSessionName,
              onNewSession: () => handleNewSession(project.name),
            };

            return (
              <div key={project.name}>
                {/* Mobile Card */}
                <ProjectCard {...commonCardProps} />

                {/* Desktop Card */}
                <ProjectCardDesktop {...commonCardProps} />
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
});

export default ProjectList;
