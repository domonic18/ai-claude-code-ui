/**
 * useFileReferences Hook
 *
 * Manages file reference functionality with @ symbol.
 * Provides file search, filtering, and reference insertion.
 *
 * Features:
 * - Detect @ symbol in input
 * - Load and filter files from project
 * - Keyboard navigation
 * - File path completion
 */

import { useState, useCallback, useEffect } from 'react';

export interface FileReference {
  /** File path */
  path: string;
  /** File name */
  name: string;
  /** File extension */
  extension?: string;
  /** File type (file/directory) */
  type: 'file' | 'directory';
  /** Relative path from project root */
  relativePath: string;
}

export interface UseFileReferencesOptions {
  /** Selected project name */
  selectedProject?: string;
  /** Authenticated fetch function */
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Callback when file is referenced */
  onFileReference?: (file: FileReference) => void;
}

export interface UseFileReferencesReturn {
  /** All available files */
  files: FileReference[];
  /** Filtered files based on query */
  filteredFiles: FileReference[];
  /** Whether file menu should be shown */
  showMenu: boolean;
  /** Current search query */
  query: string;
  /** Currently selected index */
  selectedIndex: number;
  /** Position of @ symbol in input */
  atPosition: number;
  /** Whether files are loading */
  isLoading: boolean;
  /** Set query for filtering */
  setQuery: (query: string) => void;
  /** Set selected index */
  setSelectedIndex: (index: number) => void;
  /** Set at symbol position */
  setAtPosition: (position: number) => void;
  /** Set menu visibility */
  setShowMenu: (show: boolean) => void;
  /** Handle file selection */
  handleFileSelect: (file: FileReference, index: number, isHover?: boolean) => void;
}

/**
 * Hook for managing file references
 */
export function useFileReferences({
  selectedProject,
  authenticatedFetch,
  onFileReference,
}: UseFileReferencesOptions): UseFileReferencesReturn {
  const [files, setFiles] = useState<FileReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [atPosition, setAtPosition] = useState(-1);

  /**
   * Load files from project
   */
  const loadFiles = useCallback(async () => {
    if (!selectedProject || !authenticatedFetch) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`/api/files/list?project=${encodeURIComponent(selectedProject)}`);
      if (!response.ok) {
        throw new Error('Failed to load files');
      }

      const data = await response.json();
      const fileList: FileReference[] = (data.files || []).map((file: any) => ({
        path: file.path,
        name: file.name,
        extension: file.extension,
        type: file.type || 'file',
        relativePath: file.relativePath || file.path,
      }));

      setFiles(fileList);
    } catch (error) {
      console.error('Failed to load files:', error);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject, authenticatedFetch]);

  // Load files when project changes
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  /**
   * Filtered files based on query
   */
  const filteredFiles = useCallback(() => {
    if (!query) {
      return files.slice(0, 20); // Limit to 20 files
    }

    const lowerQuery = query.toLowerCase();
    return files
      .filter(file =>
        file.name.toLowerCase().includes(lowerQuery) ||
        file.relativePath.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 20);
  }, [files, query]);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((file: FileReference, index: number, isHover?: boolean) => {
    if (!isHover) {
      onFileReference?.(file);
    }
  }, [onFileReference]);

  return {
    files,
    filteredFiles: filteredFiles(),
    showMenu,
    query,
    selectedIndex,
    atPosition,
    isLoading,
    setQuery,
    setSelectedIndex,
    setAtPosition,
    setShowMenu,
    handleFileSelect,
  };
}
