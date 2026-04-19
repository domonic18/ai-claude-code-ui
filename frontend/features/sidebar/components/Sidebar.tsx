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

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import SidebarHeader from './SidebarHeader';
import ProjectList from './ProjectList';
import ProjectCreationWizard from './ProjectCreationWizard';
import UserMenu from './UserMenu';
import { ConfirmDialog } from '@/shared/components/ui';
import type { SidebarProps } from '../types/sidebar.types';
import { useProjects } from '../hooks';
import { useSessions } from '../hooks';
import { useStarredProjects } from '../hooks';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation';
import { useSidebarState } from '../hooks/useSidebarState';
import { logger } from '@/shared/utils/logger';

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
  isPWA,
  isMobile,
  onToggleSidebar,
}: SidebarProps) {
  const { t } = useTranslation();

  // Initialize all custom hooks
  const projectsHook = useProjects(propProjects);
  const sessionsHook = useSessions();
  const { starredProjects, toggleStar } = useStarredProjects();

  // Delete confirmation hook
  const {
    deleteConfirmState,
    isDeleting,
    handleSessionDelete,
    handleConfirmSessionDelete,
    handleCancelSessionDelete,
  } = useDeleteConfirmation({
    deleteSession: sessionsHook.deleteSession,
    onSessionDelete,
    onRefresh,
  });

  // Consolidate all state management in custom hook
  const {
    expandedProjects,
    editingProject,
    editingName,
    currentTime,
    showNewProject,
    isRefreshing,
    editingSession,
    editingSessionName,
    mergedProjects,
    loadingSessions,
    hasMore,
    setShowNewProject,
    setEditingName,
    setEditingSession,
    setEditingSessionName,
    handleRefresh,
    handleToggleProject,
    handleStartEditing,
    handleCancelEditing,
    handleSaveProjectName,
    handleDeleteProject,
    handleSelectProject,
    handleSessionClick,
    handleUpdateSessionSummary,
    handleLoadMoreSessions,
    handleNewSession,
    createProject,
  } = useSidebarState(
    {
      selectedProject,
      selectedSession,
      onRefresh,
      onProjectSelect,
      onProjectDelete,
      onSessionSelect,
      onNewSession,
    },
    {
      ...projectsHook,
      ...sessionsHook,
      starredProjects,
      toggleStar,
    }
  );

  return (
    <>
      {/* Project Creation Wizard Modal */}
      {showNewProject && createPortal(
        <ProjectCreationWizard
          isOpen={showNewProject}
          onClose={() => setShowNewProject(false)}
          onProjectCreated={async (newProject) => {
            try {
              const created = await createProject(newProject.fullPath || (newProject as any).path);
              if (onProjectSelect && created) {
                onProjectSelect(created);
              }
              setShowNewProject(false);
            } catch (error) {
              logger.error('Error creating project:', error);
            }
          }}
        />,
        document.body
      )}

      {/* Delete Session Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmState.isOpen}
        title={t('sidebar.confirmDeleteSession') || 'Delete Session'}
        message={t('sidebar.confirmDeleteSessionMessage') || 'Are you sure you want to delete this session? This action cannot be undone.'}
        confirmLabel={t('sidebar.delete') || 'Delete'}
        cancelLabel={t('sidebar.cancel') || 'Cancel'}
        type="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmSessionDelete}
        onCancel={handleCancelSessionDelete}
      />

      <div
        className="h-full flex flex-col bg-card md:select-none"
        data-tour="sidebar"
        style={isPWA && isMobile ? { paddingTop: '44px' } : {}}
      >
        {/* Header */}
        <SidebarHeader
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onNewSession={handleNewSession}
          isPWA={isPWA}
          isMobile={isMobile}
          onToggleSidebar={onToggleSidebar}
        />

        {/* Project List */}
        <ProjectList
          projects={mergedProjects}
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          expandedProjects={expandedProjects}
          starredProjects={starredProjects}
          editingProject={editingProject}
          editingName={editingName}
          loadingSessions={loadingSessions}
          hasMoreSessions={hasMore}
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

        {/* User Menu Footer */}
        <div className="p-2 border-t border-border flex-shrink-0">
          <UserMenu onShowSettings={onShowSettings} />
        </div>
      </div>
    </>
  );
});

export default Sidebar;
