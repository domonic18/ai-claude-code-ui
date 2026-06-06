/**
 * useDeleteConfirmation Hook
 *
 * Custom hook for managing session deletion confirmation dialog state and handlers.
 * Encapsulates the delete confirmation logic to reduce component complexity.
 */

import { useState, useCallback } from 'react';
import type { SessionProvider } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Delete confirmation dialog state
 */
interface DeleteConfirmState {
  isOpen: boolean;
  projectName: string;
  sessionId: string;
  provider?: SessionProvider;
}

interface ProjectDeleteConfirmState {
  isOpen: boolean;
  projectName: string;
  displayName: string;
  sessionCount: number;
}

/**
 * Initial state for delete confirmation dialog
 */
const initialDeleteConfirmState: DeleteConfirmState = {
  isOpen: false,
  projectName: '',
  sessionId: '',
  provider: undefined,
};

const initialProjectDeleteConfirmState: ProjectDeleteConfirmState = {
  isOpen: false,
  projectName: '',
  displayName: '',
  sessionCount: 0,
};

/**
 * Options for the useDeleteConfirmation hook
 */
interface UseDeleteConfirmationOptions {
  /** Function to delete the session */
  deleteSession: (projectName: string, sessionId: string, provider?: SessionProvider) => Promise<void>;
  /** Callback after successful deletion */
  onSessionDelete?: (projectName: string, sessionId: string, provider?: SessionProvider) => void;
  /** Function to refresh projects after deletion */
  onRefresh?: () => void | Promise<void>;
  /** Function to delete a project */
  deleteProject?: (name: string) => Promise<void>;
  /** Callback after successful project deletion */
  onProjectDelete?: (name: string) => void;
}

/**
 * Return value for useDeleteConfirmation hook
 */
interface UseDeleteConfirmationReturn {
  /** Current delete confirmation dialog state */
  deleteConfirmState: DeleteConfirmState;
  /** Whether deletion is in progress */
  isDeleting: boolean;
  /** Open the delete confirmation dialog */
  handleSessionDelete: (projectName: string, sessionId: string, provider?: SessionProvider) => void;
  /** Confirm and execute the deletion */
  handleConfirmSessionDelete: () => Promise<void>;
  /** Cancel the deletion */
  handleCancelSessionDelete: () => void;
  /** Project delete confirmation state */
  projectDeleteConfirmState: ProjectDeleteConfirmState;
  /** Whether project deletion is in progress */
  isDeletingProject: boolean;
  /** Open the project delete confirmation dialog */
  handleProjectDelete: (projectName: string, displayName: string, sessionCount?: number) => Promise<void>;
  /** Confirm and execute the project deletion */
  handleConfirmProjectDelete: () => Promise<void>;
  /** Cancel the project deletion */
  handleCancelProjectDelete: () => void;
}

/**
 * Custom hook for managing session deletion confirmation
 *
 * @param options - Hook options
 * @returns Hook state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   deleteConfirmState,
 *   isDeleting,
 *   handleSessionDelete,
 *   handleConfirmSessionDelete,
 *   handleCancelSessionDelete
 * } = useDeleteConfirmation({
 *   deleteSession,
 *   onSessionDelete,
 *   onRefresh
 * });
 * ```
 */
export function useDeleteConfirmation({
  deleteSession,
  onSessionDelete,
  onRefresh,
  deleteProject,
  onProjectDelete,
}: UseDeleteConfirmationOptions): UseDeleteConfirmationReturn {
  const [deleteConfirmState, setDeleteConfirmState] = useState<DeleteConfirmState>(initialDeleteConfirmState);
  const [isDeleting, setIsDeleting] = useState(false);
  const [projectDeleteConfirmState, setProjectDeleteConfirmState] = useState<ProjectDeleteConfirmState>(initialProjectDeleteConfirmState);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  /**
   * Open the delete confirmation dialog
   */
  const handleSessionDelete = useCallback((projectName: string, sessionId: string, provider?: SessionProvider) => {
    setDeleteConfirmState({
      isOpen: true,
      projectName,
      sessionId,
      provider,
    });
  }, []);

  /**
   * Handle the actual session deletion after confirmation
   */
  const handleConfirmSessionDelete = useCallback(async () => {
    const { projectName, sessionId, provider } = deleteConfirmState;

    setIsDeleting(true);
    try {
      await deleteSession(projectName, sessionId, provider);

      // Only call parent callback if deletion was successful
      if (onSessionDelete) {
        onSessionDelete(projectName, sessionId, provider);
      }

      // Refresh projects to update the UI with latest session list
      // This ensures the deleted session is removed from propProjects
      if (onRefresh) {
        await onRefresh();
      }

      // Close dialog on success
      setDeleteConfirmState(initialDeleteConfirmState);
    } catch (error: unknown) {
      logger.error('[useDeleteConfirmation] Error deleting session:', error);

      // Keep dialog open on error to allow user to see what happened
      // You could add error state to the dialog here if needed
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete session. Please try again.';
      // For now, log the error - in a real app you might want to show this in the dialog
      logger.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmState, deleteSession, onSessionDelete, onRefresh]);

  const handleCancelSessionDelete = useCallback(() => {
    setDeleteConfirmState(initialDeleteConfirmState);
  }, []);

  const handleProjectDelete = useCallback(async (projectName: string, displayName: string, sessionCount: number = 0) => {
    setProjectDeleteConfirmState({ isOpen: true, projectName, displayName, sessionCount });
  }, []);

  const handleConfirmProjectDelete = useCallback(async () => {
    const { projectName } = projectDeleteConfirmState;
    setIsDeletingProject(true);
    try {
      if (deleteProject) {
        await deleteProject(projectName);
      }
      if (onProjectDelete) {
        onProjectDelete(projectName);
      }
      if (onRefresh) {
        await onRefresh();
      }
      setProjectDeleteConfirmState(initialProjectDeleteConfirmState);
    } catch (error: unknown) {
      logger.error('[useDeleteConfirmation] Error deleting project:', error);
    } finally {
      setIsDeletingProject(false);
    }
  }, [projectDeleteConfirmState, deleteProject, onProjectDelete, onRefresh]);

  const handleCancelProjectDelete = useCallback(() => {
    setProjectDeleteConfirmState(initialProjectDeleteConfirmState);
  }, []);

  return {
    deleteConfirmState,
    isDeleting,
    handleSessionDelete,
    handleConfirmSessionDelete,
    handleCancelSessionDelete,
    projectDeleteConfirmState,
    isDeletingProject,
    handleProjectDelete,
    handleConfirmProjectDelete,
    handleCancelProjectDelete,
  };
}

export default useDeleteConfirmation;
