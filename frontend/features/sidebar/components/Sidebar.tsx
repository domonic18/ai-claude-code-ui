/**
 * Sidebar Component
 *
 * Main container for the sidebar feature module.
 * Refactored to use custom hooks for state management.
 *
 * Features:
 * - Project list
 * - Session management
 * - Version update banner
 * - Responsive design (mobile/desktop)
 */

import { memo, useCallback } from 'react';
import SidebarHeader from './SidebarHeader';
import ProjectList from './ProjectList';
import UserMenu from './UserMenu';
import { SidebarModals } from './SidebarModals';
import type { SidebarProps, Session } from '../types/sidebar.types';
import { useProjects, useSessions, useStarredProjects } from '../hooks';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation';
import { useSidebarState } from '../hooks/useSidebarState';

/**
 * Sidebar Component
 */
export const Sidebar = memo(function Sidebar({
  projects: propProjects, selectedProject, selectedSession, isLoading,
  onProjectSelect, onSessionSelect, onSessionDelete, onProjectDelete,
  onRefresh, onNewSession, onShowSettings, isPWA, isMobile, onToggleSidebar,
}: SidebarProps) {
  const projectsHook = useProjects(propProjects);
  const sessionsHook = useSessions();
  const { starredProjects, toggleStar } = useStarredProjects();
  const { deleteConfirmState, isDeleting, handleSessionDelete,
    handleConfirmSessionDelete, handleCancelSessionDelete,
    projectDeleteConfirmState, isDeletingProject,
    handleProjectDelete, handleConfirmProjectDelete, handleCancelProjectDelete,
  } = useDeleteConfirmation({
    deleteSession: sessionsHook.deleteSession, onSessionDelete, onRefresh,
    deleteProject: projectsHook.deleteProject, onProjectDelete,
  });

  const state = useSidebarState(
    { selectedProject, selectedSession, onRefresh, onProjectSelect, onProjectDelete, onSessionSelect, onNewSession, onSessionDelete, isLoading: isLoading ?? false, onShowSettings, isPWA, isMobile, projects: propProjects, onToggleSidebar },
    {
      refreshProjects: projectsHook.refresh, createProject: projectsHook.createProject,
      renameProject: projectsHook.renameProject, deleteProject: projectsHook.deleteProject,
      updateSessionSummary: projectsHook.updateSessionSummary, getSortedProjects: projectsHook.getSortedProjects,
      loadingSessions: sessionsHook.loadingSessions, loadMoreSessions: sessionsHook.loadMoreSessions,
      renameSession: sessionsHook.renameSession, additionalSessions: sessionsHook.additionalSessions,
      hasMore: sessionsHook.hasMore, initializeHasMore: sessionsHook.initializeHasMore,
      starredProjects, toggleStar,
    }
  );

  const handleNewSessionWithPlaceholder = useCallback((projectName: string) => {
    const placeholder: Session = {
      id: `__placeholder__${Date.now()}`,
      summary: '',
      lastActivity: new Date().toISOString(),
      __projectName: projectName,
    };
    state.setPlaceholderSession(placeholder);
    onNewSession?.(projectName);
  }, [onNewSession, state.setPlaceholderSession]);

  return (
    <>
      <SidebarModals showNewProject={state.showNewProject} setShowNewProject={state.setShowNewProject}
        createProject={state.createProject} onProjectSelect={onProjectSelect} onRefresh={onRefresh}
        deleteConfirmState={deleteConfirmState} isDeleting={isDeleting}
        handleConfirmSessionDelete={handleConfirmSessionDelete} handleCancelSessionDelete={handleCancelSessionDelete}
        projectDeleteConfirmState={projectDeleteConfirmState} isDeletingProject={isDeletingProject}
        handleConfirmProjectDelete={handleConfirmProjectDelete} handleCancelProjectDelete={handleCancelProjectDelete} />
      <div className="h-full flex flex-col bg-card md:select-none" data-tour="sidebar"
        style={isPWA && isMobile ? { paddingTop: '44px' } : {}}>
        <SidebarHeader isRefreshing={state.isRefreshing} onRefresh={state.handleRefresh}
          onNewSession={state.handleNewSession} isPWA={isPWA} isMobile={isMobile} onToggleSidebar={onToggleSidebar}
          onNewProject={() => state.setShowNewProject(true)} />
        <ProjectList {...{
          projects: state.mergedProjects, selectedProject, selectedSession,
          expandedProjects: state.expandedProjects, starredProjects, editingProject: state.editingProject,
          editingName: state.editingName, loadingSessions: state.loadingSessions, hasMoreSessions: state.hasMore,
          currentTime: state.currentTime, isLoading, onToggleProject: state.handleToggleProject,
          onStartEditing: state.handleStartEditing, onCancelEditing: state.handleCancelEditing,
          onSaveProjectName: state.handleSaveProjectName, onSetEditingName: state.setEditingName,
          onToggleStar: toggleStar, onDeleteProject: handleProjectDelete, onSelectProject: state.handleSelectProject,
          onSessionClick: state.handleSessionClick, onDeleteSession: async (...args) => handleSessionDelete(...args),
          onUpdateSessionSummary: state.handleUpdateSessionSummary, onLoadMoreSessions: state.handleLoadMoreSessions,
          onSetEditingSession: (session) => state.setEditingSession(session?.id ?? null),
          onSetEditingSessionName: state.setEditingSessionName,
          editingSession: state.editingSession ? { id: state.editingSession } as any : null,
          editingSessionName: state.editingSessionName, onNewSession: handleNewSessionWithPlaceholder,
        }} />
        <div className="p-2 border-t border-border flex-shrink-0">
          <UserMenu onShowSettings={onShowSettings} />
        </div>
      </div>
    </>
  );
});

export default Sidebar;
