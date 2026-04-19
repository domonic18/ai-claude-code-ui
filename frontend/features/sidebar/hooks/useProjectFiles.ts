/**
 * useProjectFiles Hook
 *
 * Hook for managing file operations within a project.
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/shared/services';
import type { Project, ProjectFile } from '../types/sidebar.types';
import { logger } from '@/shared/utils/logger';

/**
 * Hook for project files
 */
export interface UseProjectFilesReturn {
  files: ProjectFile[];
  isLoading: boolean;
  error: string | null;
  refreshFiles: () => Promise<void>;
  createFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
}

/**
 * Helper function to execute file operations with consistent error handling
 */
async function executeFileOperation(
  project: Project | null,
  operation: () => Promise<Response>,
  refreshFiles: () => Promise<void>,
  setIsLoading: (v: boolean) => void,
  setError: (e: string | null) => void,
  errorMsg: string
) {
  if (!project) return;

  setIsLoading(true);
  setError(null);
  try {
    const response = await operation();
    if (response.ok) {
      await refreshFiles();
    } else {
      throw new Error(errorMsg);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    setError(errorMessage);
    logger.error(`${errorMsg}:`, err);
  } finally {
    setIsLoading(false);
  }
}

/**
 * Creates a refreshFiles callback for the given project
 */
function createRefreshCallback(
  project: Project | null,
  setFiles: (files: ProjectFile[]) => void,
  setIsLoading: (v: boolean) => void,
  setError: (e: string | null) => void
) {
  return useCallback(async () => {
    if (!project) {
      setFiles([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.files(project.name);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.data || []);
      } else {
        throw new Error('Failed to fetch files');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to refresh files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project, setFiles, setIsLoading, setError]);
}

export function useProjectFiles(project: Project | null): UseProjectFilesReturn {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFiles = createRefreshCallback(project, setFiles, setIsLoading, setError);

  const createFile = useCallback(async (path: string) => {
    await executeFileOperation(project, () => api.projects.createFile(project!.name, path), refreshFiles, setIsLoading, setError, 'Failed to create file');
  }, [project, refreshFiles, setIsLoading, setError]);

  const deleteFile = useCallback(async (path: string) => {
    await executeFileOperation(project, () => api.projects.deleteFile(project!.name, path), refreshFiles, setIsLoading, setError, 'Failed to delete file');
  }, [project, refreshFiles, setIsLoading, setError]);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    await executeFileOperation(project, () => api.projects.renameFile(project!.name, oldPath, newPath), refreshFiles, setIsLoading, setError, 'Failed to rename file');
  }, [project, refreshFiles, setIsLoading, setError]);

  useEffect(() => { refreshFiles(); }, [project, refreshFiles]);

  return { files, isLoading, error, refreshFiles, createFile, deleteFile, renameFile };
}
