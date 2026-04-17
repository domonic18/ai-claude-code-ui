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

export function useProjectFiles(project: Project | null): UseProjectFilesReturn {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFiles = useCallback(async () => {
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
  }, [project]);

  const createFile = useCallback(async (path: string) => {
    if (!project) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.createFile(project.name, path);
      if (response.ok) {
        await refreshFiles();
      } else {
        throw new Error('Failed to create file');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to create file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project, refreshFiles]);

  const deleteFile = useCallback(async (path: string) => {
    if (!project) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.deleteFile(project.name, path);
      if (response.ok) {
        await refreshFiles();
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to delete file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project, refreshFiles]);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    if (!project) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.projects.renameFile(project.name, oldPath, newPath);
      if (response.ok) {
        await refreshFiles();
      } else {
        throw new Error('Failed to rename file');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to rename file:', err);
    } finally {
      setIsLoading(false);
    }
  }, [project, refreshFiles]);

  useEffect(() => {
    refreshFiles();
  }, [project, refreshFiles]);

  return {
    files,
    isLoading,
    error,
    refreshFiles,
    createFile,
    deleteFile,
    renameFile,
  };
}
