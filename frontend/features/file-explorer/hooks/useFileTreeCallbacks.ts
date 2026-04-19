/**
 * File Tree Callbacks Hook
 *
 * Creates all the callback functions for file tree operations
 */

import { useCallback } from 'react';
import type { FileNode, FileViewMode } from '../types';

interface UseFileTreeCallbacksOptions {
  isMountedRef: React.RefObject<boolean>;
  selectedProject: { name: string; path: string } | null;
  files: FileNode[];
  searchQuery: string;
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>;
  setViewMode: React.Dispatch<React.SetStateAction<FileViewMode>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileNode | null>>;
  onError?: (error: Error) => void;
}

/**
 * Helper to fetch files from API
 */
async function fetchFilesFromAPI(
  selectedProject: { name: string; path: string } | null,
  isMountedRef: React.RefObject<boolean>,
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<Error | null>>,
  onError?: (error: Error) => void
): Promise<void> {
  if (!selectedProject) {
    setFiles([]);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const response = await fetch(`/api/projects/${selectedProject.name}/files`);

    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.statusText}`);
    }

    const responseData = await response.json();
    const data = responseData.data ?? responseData;
    const fileList = Array.isArray(data) ? data : [];

    if (isMountedRef.current) {
      setFiles(fileList);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    if (isMountedRef.current) {
      setError(error);
      onError?.(error);
    }
  } finally {
    if (isMountedRef.current) {
      setLoading(false);
    }
  }
}

/**
 * Toggle directory expanded state
 */
function toggleDirectoryState(
  path: string,
  expandedDirs: Set<string>
): Set<string> {
  const newExpanded = new Set(expandedDirs);
  if (newExpanded.has(path)) {
    newExpanded.delete(path);
  } else {
    newExpanded.add(path);
  }
  return newExpanded;
}

/**
 * Set view mode and persist to localStorage
 */
function setViewModeWithPersistence(
  mode: FileViewMode,
  setViewMode: React.Dispatch<React.SetStateAction<FileViewMode>>
): void {
  setViewMode(mode);
  try {
    localStorage.setItem('file-tree-view-mode', mode);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Filter files based on search query
 */
function filterFilesByQuery(
  files: FileNode[],
  searchQuery: string
): FileNode[] {
  if (!searchQuery.trim()) {
    return files;
  }

  const query = searchQuery.toLowerCase();

  const filterNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes.reduce<FileNode[]>((filtered, node) => {
      const matchesName = node.name.toLowerCase().includes(query);
      let filteredChildren: FileNode[] = [];

      if (node.type === 'directory' && node.children) {
        filteredChildren = filterNodes(node.children);
      }

      // Include if name matches or has matching children
      if (matchesName || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      }

      return filtered;
    }, []);
  };

  return filterNodes(files);
}

export function useFileTreeCallbacks(options: UseFileTreeCallbacksOptions) {
  const {
    isMountedRef,
    selectedProject,
    files,
    searchQuery,
    setFiles,
    setLoading,
    setError,
    setExpandedDirs,
    setViewMode,
    setSelectedFile,
    onError,
  } = options;

  const fetchFiles = useCallback(async () => {
    await fetchFilesFromAPI(
      selectedProject,
      isMountedRef,
      setFiles,
      setLoading,
      setError,
      onError
    );
  }, [selectedProject, isMountedRef, setFiles, setLoading, setError, onError]);

  const toggleDirectory = useCallback((path: string) => {
    setExpandedDirs(prev => toggleDirectoryState(path, prev));
  }, [setExpandedDirs]);

  const selectFile = useCallback((file: FileNode | null) => {
    setSelectedFile(file);
  }, [setSelectedFile]);

  const setViewModeWithPersist = useCallback((mode: FileViewMode) => {
    setViewModeWithPersistence(mode, setViewMode);
  }, [setViewMode]);

  const refreshFiles = useCallback(async () => {
    await fetchFiles();
  }, [fetchFiles]);

  const filteredFiles = useCallback((): FileNode[] => {
    return filterFilesByQuery(files, searchQuery);
  }, [files, searchQuery]);

  return {
    fetchFiles,
    toggleDirectory,
    selectFile,
    setViewModeWithPersist,
    refreshFiles,
    filteredFiles,
  };
}
