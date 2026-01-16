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
 * - Integration with TaskMaster context
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import ReactDOM from 'react-dom';
import SidebarHeader from './SidebarHeader';
import ProjectSearch from './ProjectSearch';
import VersionBanner from './VersionBanner';
import ProjectList from './ProjectList';
import ProjectCreationWizard from '../../../components/ProjectCreationWizard';
import { useTaskMaster } from '../../../contexts/TaskMasterContext';
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
  onProjectSelect,
  onSessionSelect,
  onSessionDelete,
  onProjectDelete,
  onRefresh,
  updateAvailable,
  latestVersion,
  currentVersion,
  onShowVersionModal,
  isPWA,
  isMobile,
  onToggleSidebar,
}: SidebarProps) {
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

  // TaskMaster context
  const { setCurrentProject } = useTaskMaster();

  // Auto-update timestamps every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, TIMESTAMP_UPDATE_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  // Auto-expand project when a session is selected
  useEffect(() => {
    if (selectedSession && selectedProject) {
      setExpandedProjects(prev => new Set([...prev, selectedProject.name]));
    }
  }, [selectedSession, selectedProject]);

  // Filter and sort projects
  const filteredAndSortedProjects = getSortedProjects(starredProjects);
  const displayProjects = searchFilter
    ? filteredProjects(filteredAndSortedProjects)
    : filteredAndSortedProjects;

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProjects();
      if (onRefresh) {
        await onRefresh();
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
    await renameProject(projectName, newName);
    setEditingProject(null);
    setEditingName('');
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
    setCurrentProject(project);
  }, [onProjectSelect, setCurrentProject]);

  const handleSessionClick = useCallback((session: any, projectName: string) => {
    if (onSessionSelect) {
      onSessionSelect(session, projectName);
    }
  }, [onSessionSelect]);

  const handleSessionDelete = useCallback(async (projectName: string, sessionId: string, provider?: any) => {
    await deleteSession(projectName, sessionId, provider);
    if (onSessionDelete) {
      await onSessionDelete(projectName, sessionId, provider);
    }
  }, [deleteSession, onSessionDelete]);

  const handleUpdateSessionSummary = useCallback(async (projectName: string, sessionId: string, summary: string) => {
    await renameSession(projectName, sessionId, summary);
  }, [renameSession]);

  const handleLoadMoreSessions = useCallback(async (project: any) => {
    await loadMoreSessions(project.name);
  }, [loadMoreSessions]);

  return (
    <>
      {/* Project Creation Wizard Modal */}
      {showNewProject && ReactDOM.createPortal(
        <ProjectCreationWizard
          onClose={() => setShowNewProject(false)}
          onProjectCreated={async (newProject) => {
            try {
              await createProject(newProject.path);
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
          onToggleProject={handleToggleProject}
          onStartEditing={handleStartEditing}
          onCancelEditing={handleCancelEditing}
          onSaveProjectName={handleSaveProjectName}
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
        />
      </div>
    </>
  );
});

export default Sidebar;
