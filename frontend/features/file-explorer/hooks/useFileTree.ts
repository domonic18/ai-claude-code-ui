/**
 * File Explorer Hooks
 *
 * Custom hooks for file tree and file explorer functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileNode, FileViewMode } from '../types';

/**
 * Helper functions for file tree operations
 */

/**
 * Fetch files from API
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

/**
 * Expand directories containing matching files
 */
function expandMatchingDirectories(
  items: FileNode[],
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>
): void {
  items.forEach(item => {
    if (item.type === 'directory' && item.children && item.children.length > 0) {
      setExpandedDirs(prev => new Set(prev).add(item.path));
      expandMatchingDirectories(item.children, setExpandedDirs);
    }
  });
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
 * Load view mode from localStorage
 */
function loadViewModeFromStorage(): FileViewMode | null {
  try {
    const savedViewMode = localStorage.getItem('file-tree-view-mode');
    if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
      return savedViewMode as FileViewMode;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

/**
 * Hook for managing file tree state and operations
 */
export interface UseFileTreeOptions {
  selectedProject?: {
    name: string;
    path: string;
  } | null;
  autoFetch?: boolean;
  onError?: (error: Error) => void;
}

export interface UseFileTreeReturn {
  files: FileNode[];
  loading: boolean;
  error: Error | null;
  expandedDirs: Set<string>;
  selectedFile: FileNode | null;
  viewMode: FileViewMode;
  searchQuery: string;
  filteredFiles: FileNode[];
  fetchFiles: () => Promise<void>;
  toggleDirectory: (path: string) => void;
  selectFile: (file: FileNode | null) => void;
  setViewMode: (mode: FileViewMode) => void;
  setSearchQuery: (query: string) => void;
  refreshFiles: () => Promise<void>;
}

export function useFileTree(options: UseFileTreeOptions = {}): UseFileTreeReturn {
  const { selectedProject, autoFetch = true, onError } = options;

  // State
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [viewMode, setViewMode] = useState<FileViewMode>('detailed');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Track if component is mounted
  const isMountedRef = useRef(true);

  /**
   * Fetch files from API
   */
  const fetchFiles = useCallback(async () => {
    await fetchFilesFromAPI(
      selectedProject,
      isMountedRef,
      setFiles,
      setLoading,
      setError,
      onError
    );
  }, [selectedProject, onError]);

  /**
   * Toggle directory expanded state
   */
  const toggleDirectory = useCallback((path: string) => {
    setExpandedDirs(prev => toggleDirectoryState(path, prev));
  }, []);

  /**
   * Select a file
   */
  const selectFile = useCallback((file: FileNode | null) => {
    setSelectedFile(file);
  }, []);

  /**
   * Set view mode and persist to localStorage
   */
  const setViewModeWithPersist = useCallback((mode: FileViewMode) => {
    setViewModeWithPersistence(mode, setViewMode);
  }, []);

  /**
   * Refresh files
   */
  const refreshFiles = useCallback(async () => {
    await fetchFiles();
  }, [fetchFiles]);

  /**
   * Filter files based on search query
   */
  const filteredFiles = useCallback((): FileNode[] => {
    return filterFilesByQuery(files, searchQuery);
  }, [files, searchQuery]);

  /**
   * Auto-fetch on mount and project change
   */
  useEffect(() => {
    if (autoFetch && selectedProject) {
      fetchFiles();
    }
  }, [autoFetch, selectedProject, fetchFiles]);

  /**
   * Load view mode from localStorage on mount
   */
  useEffect(() => {
    const savedViewMode = loadViewModeFromStorage();
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Auto-expand directories when searching
   */
  useEffect(() => {
    if (searchQuery.trim()) {
      expandMatchingDirectories(filteredFiles(), setExpandedDirs);
    }
  }, [searchQuery, filteredFiles]);

  return {
    files,
    loading,
    error,
    expandedDirs,
    selectedFile,
    viewMode,
    searchQuery,
    filteredFiles: filteredFiles(),
    fetchFiles,
    toggleDirectory,
    selectFile,
    setViewMode: setViewModeWithPersist,
    setSearchQuery,
    refreshFiles,
  };
}

/**
 * Hook for file operations
 */
export interface UseFileOperationsOptions {
  projectId?: string;
  onError?: (error: Error) => void;
  onSuccess?: (operation: string, result: unknown) => void;
}

/**
 * Helper function to execute file operation with error handling
 *
 * @param endpoint - API endpoint
 * @param method - HTTP method
 * @param projectId - Project ID
 * @param body - Request body
 * @param operation - Operation name for callbacks
 * @param setLoading - Set loading state
 * @param setError - Set error state
 * @param onSuccess - Success callback
 * @param onError - Error callback
 * @returns Response data
 */
async function executeFileOperation<T = unknown>(
  endpoint: string,
  method: string,
  projectId: string | undefined,
  body: object,
  operation: string,
  setLoading: (loading: boolean) => void,
  setError: (error: Error | null) => void,
  onSuccess?: (operation: string, result: T) => void,
  onError?: (error: Error) => void
): Promise<T> {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch(`/api/projects/${projectId}/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to ${operation}: ${response.statusText}`);
    }

    const data = await response.json();
    onSuccess?.(operation, data);
    return data;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(`Failed to ${operation}`);
    setError(error);
    onError?.(error);
    throw error;
  } finally {
    setLoading(false);
  }
}

export function useFileOperations(options: UseFileOperationsOptions = {}) {
  const { projectId, onError, onSuccess } = options;
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Read file content
   */
  const readFile = useCallback(async (filePath: string): Promise<string> => {
    const data = await executeFileOperation(
      'files/read',
      'POST',
      projectId,
      { path: filePath },
      'read file',
      setLoading,
      setError,
      onSuccess,
      onError
    );
    return (data as { content: string }).content;
  }, [projectId, onSuccess, onError]);

  /**
   * Write file content
   */
  const writeFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    await executeFileOperation(
      'files/write',
      'POST',
      projectId,
      { path: filePath, content },
      'write file',
      setLoading,
      setError,
      onSuccess,
      onError
    );
  }, [projectId, onSuccess, onError]);

  /**
   * Delete file
   */
  const deleteFile = useCallback(async (filePath: string): Promise<void> => {
    await executeFileOperation(
      'files/delete',
      'DELETE',
      projectId,
      { path: filePath },
      'delete file',
      setLoading,
      setError,
      onSuccess,
      onError
    );
  }, [projectId, onSuccess, onError]);

  /**
   * Create directory
   */
  const createDirectory = useCallback(async (dirPath: string): Promise<void> => {
    await executeFileOperation(
      'files/mkdir',
      'POST',
      projectId,
      { path: dirPath },
      'create directory',
      setLoading,
      setError,
      onSuccess,
      onError
    );
  }, [projectId, onSuccess, onError]);

  return {
    loading,
    error,
    readFile,
    writeFile,
    deleteFile,
    createDirectory,
  };
}
