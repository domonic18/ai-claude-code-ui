/**
 * File Explorer Hooks
 *
 * Custom hooks for file tree and file explorer functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileNode, FileViewMode } from '../types';

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
  }, [selectedProject, onError]);

  /**
   * Toggle directory expanded state
   */
  const toggleDirectory = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return newExpanded;
    });
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
    setViewMode(mode);
    try {
      localStorage.setItem('file-tree-view-mode', mode);
    } catch {
      // Ignore localStorage errors
    }
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
    try {
      const savedViewMode = localStorage.getItem('file-tree-view-mode');
      if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
        setViewMode(savedViewMode as FileViewMode);
      }
    } catch {
      // Ignore localStorage errors
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
      const expandMatches = (items: FileNode[]) => {
        items.forEach(item => {
          if (item.type === 'directory' && item.children && item.children.length > 0) {
            setExpandedDirs(prev => new Set(prev).add(item.path));
            expandMatches(item.children);
          }
        });
      };
      expandMatches(filteredFiles());
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

export function useFileOperations(options: UseFileOperationsOptions = {}) {
  const { projectId, onError, onSuccess } = options;
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Read file content
   */
  const readFile = useCallback(async (filePath: string): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/files/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });

      if (!response.ok) {
        throw new Error(`Failed to read file: ${response.statusText}`);
      }

      const data = await response.json();
      onSuccess?.('read', data);
      return data.content;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to read file');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [projectId, onError, onSuccess]);

  /**
   * Write file content
   */
  const writeFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });

      if (!response.ok) {
        throw new Error(`Failed to write file: ${response.statusText}`);
      }

      const data = await response.json();
      onSuccess?.('write', data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to write file');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [projectId, onError, onSuccess]);

  /**
   * Delete file
   */
  const deleteFile = useCallback(async (filePath: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/files/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }

      const data = await response.json();
      onSuccess?.('delete', data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete file');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [projectId, onError, onSuccess]);

  /**
   * Create directory
   */
  const createDirectory = useCallback(async (dirPath: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/files/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dirPath }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create directory: ${response.statusText}`);
      }

      const data = await response.json();
      onSuccess?.('mkdir', data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create directory');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [projectId, onError, onSuccess]);

  return {
    loading,
    error,
    readFile,
    writeFile,
    deleteFile,
    createDirectory,
  };
}
