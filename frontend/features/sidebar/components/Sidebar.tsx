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

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import SidebarHeader from './SidebarHeader';
import ProjectList from './ProjectList';
import ProjectCreationWizard from './ProjectCreationWizard';
import UserMenu from './UserMenu';
import { ConfirmDialog } from '@/shared/components/ui';
import { TIMESTAMP_UPDATE_INTERVAL, SESSION_PAGINATION } from '../constants/sidebar.constants';
import type { SidebarProps, ExpandedProjects, SessionProvider } from '../types/sidebar.types';
import { useProjects } from '../hooks';
import { useSessions } from '../hooks';
import { useStarredProjects } from '../hooks';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation';
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

  // Custom hooks
  const {
    refresh: refreshProjects,
    createProject,
    renameProject,
    deleteProject,
    updateSessionSummary,
    getSortedProjects,
  } = useProjects(propProjects);

  const {
    loadingSessions,
    loadMoreSessions,
    renameSession,
    deleteSession,
    additionalSessions,
    hasMore,
    initializeHasMore,
  } = useSessions();

  const {
    starredProjects,
    toggleStar,
  } = useStarredProjects();

  // Delete confirmation hook
  const {
    deleteConfirmState,
    isDeleting,
    handleSessionDelete,
    handleConfirmSessionDelete,
    handleCancelSessionDelete,
  } = useDeleteConfirmation({
    deleteSession,
    onSessionDelete,
    onRefresh,
  });

  // Sort projects
  const displayProjects = getSortedProjects(starredProjects);

  // Local state
  const [expandedProjects, setExpandedProjects] = useState<ExpandedProjects>(new Set());
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNewProject, setShowNewProject] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  // Initialize hasMore state from project sessionMeta
  useEffect(() => {
    displayProjects.forEach(project => {
      if (project.sessionMeta?.hasMore !== undefined && hasMore[project.name] === undefined) {
        initializeHasMore(project.name, project.sessionMeta.hasMore);
      }
    });
  }, [displayProjects, hasMore, initializeHasMore]);

  // Auto-update timestamps every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, TIMESTAMP_UPDATE_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  // Auto-expand project when a project is selected or a session is selected
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

    // Auto-expand when project is selected (even without session) or when session is selected
    if (hasChanged && selectedProject) {
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

  // Merge additional sessions into projects (since we only have one project now)
  const mergedProjects = useMemo(() => {
    return displayProjects.map(project => {
      const additional = additionalSessions[project.name] || [];
      if (additional.length === 0) {
        return project;
      }

      // Merge sessions by provider
      return {
        ...project,
        sessions: [...(project.sessions || []), ...additional.filter(s => !s.__provider || s.__provider === 'claude')],
        cursorSessions: [...(project.cursorSessions || []), ...additional.filter(s => s.__provider === 'cursor')],
        codexSessions: [...(project.codexSessions || []), ...additional.filter(s => s.__provider === 'codex')],
      };
    });
  }, [displayProjects, additionalSessions]);

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
      logger.error('Error renaming project:', error);
      // Don't clear editing state on error, allowing user to retry
    }
  }, [renameProject]);

  const handleDeleteProject = useCallback(async (projectName: string) => {
    await deleteProject(projectName);
    if (onProjectDelete) {
      onProjectDelete(projectName);
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

  const handleUpdateSessionSummary = useCallback(async (projectName: string, sessionId: string, summary: string) => {
    try {
      await renameSession(projectName, sessionId, summary);
      // Optimistic local update: update the session summary in useProjects state
      // so the UI reflects the change immediately without a full server refresh
      updateSessionSummary(projectName, sessionId, summary);
      // Close editing state
      setEditingSession(null);
      setEditingSessionName('');
    } catch (error) {
      logger.error('Error updating session summary:', error);
      // Don't close editing state on error, allowing user to retry
    }
  }, [renameSession, updateSessionSummary]);

  const handleLoadMoreSessions = useCallback(async (project: any) => {
    // Find the original project from displayProjects (not merged)
    const originalProject = displayProjects.find(p => p.name === project.name);
    if (!originalProject) {
      logger.warn('[Sidebar] Project not found for loading more sessions:', project.name);
      return;
    }

    // Calculate offset based on original project sessions + already loaded additional sessions
    const baseSessionCount = (originalProject.sessions || []).length;
    const additionalSessionCount = (additionalSessions[project.name] || []).length;

    // Total sessions already loaded
    const currentSessionCount = baseSessionCount + additionalSessionCount;
    const offset = currentSessionCount;

    logger.info('[Sidebar] Loading more sessions:', {
      projectName: project.name,
      baseSessionCount,
      additionalSessionCount,
      offset,
      currentHasMore: hasMore[project.name],
    });

    // Load more sessions (use consistent batch size)
    await loadMoreSessions(project.name, SESSION_PAGINATION.LOAD_MORE_LIMIT, offset);
  }, [displayProjects, additionalSessions, hasMore, loadMoreSessions]);

  // Since we only have one project now, create a wrapper for onNewSession
  // that doesn't require projectName parameter
  const handleNewSession = useCallback(() => {
    if (onNewSession && selectedProject) {
      onNewSession(selectedProject.name);
    }
  }, [onNewSession, selectedProject]);

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
              // 选中新创建的项目
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
          <UserMenu
            onShowSettings={onShowSettings}
          />
        </div>
      </div>
    </>
  );
});

export default Sidebar;
