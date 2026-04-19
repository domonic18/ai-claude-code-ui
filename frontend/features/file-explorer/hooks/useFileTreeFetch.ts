/**
 * useFileTreeFetch Hook
 *
 * Handles file fetching and directory expansion logic for the FileTree component.
 * Provides data loading capabilities with timeout handling.
 */

import { useEffect, useCallback } from 'react';
import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';
import type { FileNode } from '../types/file-explorer.types';

interface UseFileTreeFetchOptions {
  /** Currently selected project */
  selectedProject: { path: string; name: string } | null;
  /** Set files state callback */
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>;
  /** Set loading state callback */
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  /** Set expanded directories callback */
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface UseFileTreeFetchReturn {
  /** Fetch files from API */
  fetchFiles: () => Promise<void>;
}

/**
 * Fetch files from API with response parsing
 */
async function fetchFilesFromApi(
  projectName: string,
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>
): Promise<void> {
  try {
    const response = await api.getFiles(projectName);
    if (!response.ok) {
      logger.error('FileTree: fetchFiles failed:', response.status);
      setFiles([]);
      return;
    }
    const responseData = await response.json();
    const data = responseData.data ?? responseData;
    const filesArray = Array.isArray(data) ? data : (data.files || []);
    setFiles(filesArray);
    logger.info('FileTree: Files loaded', {
      projectId: projectName,
      count: filesArray.length
    });
  } catch (error) {
    logger.error('FileTree: Failed to load files', { projectId: projectName, error });
    setFiles([]);
  }
}

/**
 * Fetch files from API with timeout handling
 */
export function useFileTreeFetch({
  selectedProject,
  setFiles,
  setLoading,
  setExpandedDirs,
}: UseFileTreeFetchOptions): UseFileTreeFetchReturn {
  const fetchFiles = useCallback(async () => {
    if (!selectedProject) return;
    await fetchFilesFromApi(selectedProject.name, setFiles);
  }, [selectedProject, setFiles]);

  // Load files when project changes
  useEffect(() => {
    if (selectedProject) {
      setLoading(true);
      fetchFiles().finally(() => setLoading(false));
    }
  }, [selectedProject, fetchFiles, setLoading]);

  // Auto-expand first level directories when files are loaded
  useEffect(() => {
    if (selectedProject && setExpandedDirs) {
      // Get first-level directories to expand
      const firstLevelDirs = new Set<string>();
      const expandOneLevel = (nodes: FileNode[]) => {
        nodes.forEach(node => {
          if (node.type === 'directory') {
            firstLevelDirs.add(node.path);
          }
        });
      };

      // We need to get the current files from state
      // This will be called when files change
      setFiles(prevFiles => {
        expandOneLevel(prevFiles);
        return prevFiles;
      });

      if (firstLevelDirs.size > 0) {
        setExpandedDirs(firstLevelDirs);
      }
    }
  }, [selectedProject]);

  return {
    fetchFiles,
  };
}
