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

/**
 * Initial state for delete confirmation dialog
 */
const initialDeleteConfirmState: DeleteConfirmState = {
  isOpen: false,
  projectName: '',
  sessionId: '',
  provider: undefined,
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
  onRefresh?: () => Promise<void>;
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
}: UseDeleteConfirmationOptions): UseDeleteConfirmationReturn {
  const [deleteConfirmState, setDeleteConfirmState] = useState<DeleteConfirmState>(initialDeleteConfirmState);
  const [isDeleting, setIsDeleting] = useState(false);

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

  /**
   * Handle canceling the session deletion
   */
  const handleCancelSessionDelete = useCallback(() => {
    setDeleteConfirmState(initialDeleteConfirmState);
  }, []);

  return {
    deleteConfirmState,
    isDeleting,
    handleSessionDelete,
    handleConfirmSessionDelete,
    handleCancelSessionDelete,
  };
}

export default useDeleteConfirmation;
