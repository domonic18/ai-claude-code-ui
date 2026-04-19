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

import React, { memo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/shared/components/ui/ScrollArea';
import { formatTimeAgo, getAllSessions } from '../utils/timeFormatters';
import type { ProjectListProps, Project, Session, SessionProvider } from '../types/sidebar.types';
import { cn } from '../../../lib/utils';
import SessionList from './SessionList';
import { SKELETON_COUNT } from '../constants/sidebar.constants';

/**
 * Custom hook to track which projects have loaded their initial sessions
 * @param projects - Array of projects to track
 * @returns Set of project names that have loaded initial sessions
 */
function useInitialSessionTracking(projects: Project[]): Set<string> {
  const [initialSessionsLoaded, setInitialSessionsLoaded] = useState<Set<string>>(new Set());
  const prevProjectsRef = useRef<Project[]>([]);

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

  return initialSessionsLoaded;
}

/**
 * ProjectListItem - Renders a single project with its sessions
 */
interface ProjectListItemProps {
  project: Project;
  selectedSession: Session | null;
  hasMoreSessions: Record<string, boolean | undefined>;
  loadingSessions: Record<string, boolean | undefined>;
  currentTime: Date;
  initialSessionsLoaded: boolean;
  editingSession: Session | null;
  editingSessionName: string;
  onSessionClick: (session: Session, projectName: string) => void;
  onSessionDelete: (projectName: string, sessionId: string, provider?: SessionProvider) => Promise<void>;
  onSessionRename: (projectName: string, sessionId: string, summary: string) => Promise<void>;
  onLoadMoreSessions: (project: Project) => Promise<void>;
  onSetEditingSession: (session: Session | null) => void;
  onSetEditingSessionName: (name: string) => void;
  onNewSession: (projectName: string) => void;
}

const ProjectListItem = memo(function ProjectListItem({
  project,
  selectedSession,
  hasMoreSessions,
  loadingSessions,
  currentTime,
  initialSessionsLoaded,
  editingSession,
  editingSessionName,
  onSessionClick,
  onSessionDelete,
  onSessionRename,
  onLoadMoreSessions,
  onSetEditingSession,
  onSetEditingSessionName,
  onNewSession,
}: ProjectListItemProps) {
  const allSessions = getAllSessions(project);
  const hasMoreSessionsForProject = hasMoreSessions[project.name] !== false;
  const isLoadingSessionsForProject = loadingSessions[project.name];

  // Skip projects with no sessions
  if (allSessions.length === 0 && !isLoadingSessionsForProject) {
    return null;
  }

  return (
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
  );
});

/**
 * ProjectList Component
 */
export const ProjectList = memo(function ProjectList({
  projects,
  selectedSession,
  loadingSessions,
  hasMoreSessions,
  currentTime,
  isLoading,
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
          projects.map((project) => (
            <ProjectListItem
              key={project.name}
              project={project}
              selectedSession={selectedSession}
              hasMoreSessions={hasMoreSessions}
              loadingSessions={loadingSessions}
              currentTime={currentTime}
              initialSessionsLoaded={initialSessionsLoaded.has(project.name)}
              editingSession={editingSession}
              editingSessionName={editingSessionName}
              onSessionClick={onSessionClick}
              onSessionDelete={onDeleteSession}
              onSessionRename={onUpdateSessionSummary}
              onLoadMoreSessions={onLoadMoreSessions}
              onSetEditingSession={onSetEditingSession}
              onSetEditingSessionName={onSetEditingSessionName}
              onNewSession={onNewSession}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
});

export default ProjectList;
