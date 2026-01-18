/**
 * Sidebar Component
 *
 * Main container for the sidebar feature module.
 * Refactored to use custom hooks for state management.
 *
 * Features:
 * - Project list with search and filtering
 * - Session management
 * - Version update banner
 * - Responsive design (mobile/desktop)
 */

import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import SidebarHeader from './SidebarHeader';
import ProjectSearch from './ProjectSearch';
import VersionBanner from './VersionBanner';
import ProjectList from './ProjectList';
import { ProjectCreationWizard } from '@/features/project';
import { TIMESTAMP_UPDATE_INTERVAL } from '../constants/sidebar.constants';
import type { SidebarProps, ExpandedProjects } from '../types/sidebar.types';
import { useProjects } from '../hooks';
import { useSessions } from '../hooks';
import { useProjectSearch } from '../hooks';
import { useStarredProjects } from '../hooks';

/**
 * Sidebar Component
 */
export const Sidebar = memo(function Sidebar({
  projects: propProjects,
  selectedProject,
  selectedSession,
  isLoading,
  onProjectSelect,
  onSessionSelect,
  onSessionDelete,
  onProjectDelete,
  onRefresh,
  onNewSession,
  onShowSettings,
  updateAvailable,
  latestVersion,
  currentVersion,
  onShowVersionModal,
  isPWA,
  isMobile,
  onToggleSidebar,
}: SidebarProps) {
  const { t } = useTranslation();

  // Custom hooks
  const {
    projects,
    refresh: refreshProjects,
    createProject,
    renameProject,
    deleteProject,
    getSortedProjects,
  } = useProjects(propProjects);

  const {
    loadingSessions,
    loadMoreSessions,
    renameSession,
    deleteSession,
    additionalSessions,
  } = useSessions();

  const {
    searchFilter,
    setSearchFilter,
    filteredProjects,
  } = useProjectSearch();

  const {
    starredProjects,
    toggleStar,
  } = useStarredProjects();

  // Local state
  const [expandedProjects, setExpandedProjects] = useState<ExpandedProjects>(new Set());
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNewProject, setShowNewProject] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  // Auto-update timestamps every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, TIMESTAMP_UPDATE_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  // Auto-expand project when a session is selected
  // Use ref to track previous session/project to avoid unnecessary updates
  const prevSelectionRef = useRef<{ sessionId?: string; projectName?: string } | null>(null);

  useEffect(() => {
    const currentSelection = {
      sessionId: selectedSession?.id,
      projectName: selectedProject?.name
    };

    // Only expand if the selection actually changed
    const hasChanged = !prevSelectionRef.current ||
                       prevSelectionRef.current.sessionId !== currentSelection.sessionId ||
                       prevSelectionRef.current.projectName !== currentSelection.projectName;

    if (hasChanged && selectedSession && selectedProject) {
      setExpandedProjects(prev => {
        // Only update if project is not already expanded
        if (prev.has(selectedProject.name)) {
          return prev; // Return same reference to avoid re-render
        }
        return new Set([...prev, selectedProject.name]);
      });
      prevSelectionRef.current = currentSelection;
    }
  }, [selectedSession?.id, selectedProject?.name]);

  // Filter and sort projects
  const filteredAndSortedProjects = getSortedProjects(starredProjects);
  const displayProjects = searchFilter
    ? filteredProjects(filteredAndSortedProjects)
    : filteredAndSortedProjects;

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 优先调用外部传入的刷新逻辑（即父组件 useProjectManager 的刷新），
      // 它会同步状态到 props，而内部 Hook useProjects 已经监听了 props 同步。
      if (onRefresh) {
        await onRefresh();
      } else {
        await refreshProjects();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProjects, onRefresh]);

  const handleToggleProject = useCallback((projectName: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  }, []);

  const handleStartEditing = useCallback((project: any) => {
    setEditingProject(project.name);
    setEditingName(project.displayName || project.name);
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingProject(null);
    setEditingName('');
  }, []);

  const handleSaveProjectName = useCallback(async (projectName: string, newName: string) => {
    try {
      await renameProject(projectName, newName);
      setEditingProject(null);
      setEditingName('');
    } catch (error) {
      console.error('Error renaming project:', error);
      // Don't clear editing state on error, allowing user to retry
    }
  }, [renameProject]);

  const handleDeleteProject = useCallback(async (projectName: string) => {
    await deleteProject(projectName);
    if (onProjectDelete) {
      await onProjectDelete(projectName);
    }
  }, [deleteProject, onProjectDelete]);

  const handleSelectProject = useCallback((project: any) => {
    if (onProjectSelect) {
      onProjectSelect(project);
    }
  }, [onProjectSelect]);

  const handleSessionClick = useCallback((session: any, projectName: string) => {
    if (onSessionSelect) {
      onSessionSelect(session, projectName);
    }
  }, [onSessionSelect]);

  const handleSessionDelete = useCallback(async (projectName: string, sessionId: string, provider?: any) => {
    // 再次确认以确保用户看到对话框
    if (!window.confirm(t('sidebar.confirmDeleteSession') || 'Are you sure you want to delete this session?')) {
      return;
    }

    try {
      await deleteSession(projectName, sessionId, provider);
      // Only call parent callback if deletion was successful (not cancelled)
      if (onSessionDelete) {
        await onSessionDelete(projectName, sessionId, provider);
      }
    } catch (error: any) {
      // Ignore user cancellation (already handled by confirm above, but for robust error handling)
      if (error?.code === 'CANCELLED') {
        return;
      }
      console.error('[Sidebar] Error deleting session:', error);
      // Show error message to user
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete session. Please try again.';
      window.alert(errorMessage);
    }
  }, [deleteSession, onSessionDelete, t]);

  const handleUpdateSessionSummary = useCallback(async (projectName: string, sessionId: string, summary: string) => {
    try {
      await renameSession(projectName, sessionId, summary);
      // Close editing state
      setEditingSession(null);
      setEditingSessionName('');
      // Refresh to get updated data
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error updating session summary:', error);
      // Don't close editing state on error, allowing user to retry
    }
  }, [renameSession, onRefresh]);

  const handleLoadMoreSessions = useCallback(async (project: any) => {
    await loadMoreSessions(project.name);
  }, [loadMoreSessions]);

  return (
    <>
      {/* Project Creation Wizard Modal */}
      {showNewProject && ReactDOM.createPortal(
        <ProjectCreationWizard
          isOpen={showNewProject}
          onClose={() => setShowNewProject(false)}
          onProjectCreated={async (newProject) => {
            try {
              const created = await createProject(newProject.path);
              // 选中新创建的项目
              if (onProjectSelect && created) {
                onProjectSelect(created);
              }
              setShowNewProject(false);
            } catch (error) {
              console.error('Error creating project:', error);
            }
          }}
        />,
        document.body
      )}

      <div
        className="h-full flex flex-col bg-card md:select-none"
        style={isPWA && isMobile ? { paddingTop: '44px' } : {}}
      >
        {/* Header */}
        <SidebarHeader
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onShowNewProject={() => setShowNewProject(true)}
          isPWA={isPWA}
          isMobile={isMobile}
          onToggleSidebar={onToggleSidebar}
        />

        {/* Version Banner */}
        {(updateAvailable || latestVersion) && (
          <VersionBanner
            updateAvailable={updateAvailable ?? false}
            latestVersion={latestVersion}
            currentVersion={currentVersion}
            onShowVersionModal={onShowVersionModal}
          />
        )}

        {/* Search */}
        <div className="px-4 py-2 border-b border-border">
          <ProjectSearch
            searchFilter={searchFilter}
            onSearchChange={setSearchFilter}
            onClearSearch={() => setSearchFilter('')}
          />
        </div>

        {/* Project List */}
        <ProjectList
          projects={displayProjects}
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          expandedProjects={expandedProjects}
          starredProjects={starredProjects}
          editingProject={editingProject}
          editingName={editingName}
          loadingSessions={loadingSessions}
          additionalSessions={additionalSessions}
          currentTime={currentTime}
          isLoading={isLoading}
          onToggleProject={handleToggleProject}
          onStartEditing={handleStartEditing}
          onCancelEditing={handleCancelEditing}
          onSaveProjectName={handleSaveProjectName}
          onSetEditingName={setEditingName}
          onToggleStar={toggleStar}
          onDeleteProject={handleDeleteProject}
          onSelectProject={handleSelectProject}
          onSessionClick={handleSessionClick}
          onDeleteSession={handleSessionDelete}
          onUpdateSessionSummary={handleUpdateSessionSummary}
          onLoadMoreSessions={handleLoadMoreSessions}
          onSetEditingSession={setEditingSession}
          onSetEditingSessionName={setEditingSessionName}
          editingSession={editingSession}
          editingSessionName={editingSessionName}
          onNewSession={onNewSession}
        />

        {/* Settings Footer */}
        <div className="md:p-2 md:border-t md:border-border flex-shrink-0">
          {/* Mobile Settings Button */}
          {onShowSettings && (
            <div className="md:hidden p-4 pb-20 border-t border-border/50">
              <button
                onClick={onShowSettings}
                className="w-full h-14 bg-muted/50 hover:bg-muted/70 rounded-2xl flex items-center justify-start gap-4 px-4 active:scale-[0.98] transition-all duration-150"
              >
                <div className="w-10 h-10 rounded-2xl bg-background/80 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-muted-foreground">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </div>
                <span className="text-lg font-medium text-foreground">{t('sidebar.settings')}</span>
              </button>
            </div>
          )}

          {/* Desktop Settings Button */}
          {onShowSettings && (
            <button
              onClick={onShowSettings}
              className="items-center whitespace-nowrap rounded-md text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hidden md:flex w-full justify-start gap-2 p-2 h-auto font-normal text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span className="text-xs">{t('sidebar.settings')}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
});

export default Sidebar;
