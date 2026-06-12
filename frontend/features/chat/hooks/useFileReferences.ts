/**
 * useFileReferences Hook
 *
 * Manages file reference functionality with @ symbol.
 * Shares document data with useDocuments via TanStack Query cache.
 *
 * Features:
 * - Detect @ symbol in input
 * - Filter documents from shared TanStack Query cache
 * - Keyboard navigation
 * - File reference insertion as attachment
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDocumentsQuery } from '@/shared/libs/query/hooks';

export interface FileReference {
  /** File path (container-absolute) */
  path: string;
  /** File name */
  name: string;
  /** File extension */
  extension?: string;
  /** File type */
  type: 'file' | 'directory';
  /** Relative path for display */
  relativePath: string;
  /** File size in bytes */
  size?: number;
  /** MIME type */
  mimeType?: string;
}

export interface UseFileReferencesOptions {
  /** Selected project name */
  selectedProject?: string;
  /** @deprecated No longer needed — data fetched via TanStack Query shared cache */
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
 * Map document items from DocumentListResponse to FileReference objects
 * @param uploads - Array of uploaded document items
 * @param aiGenerated - Array of AI-generated document items
 * @returns FileReference array
 */
function mapDocumentsToReferences(uploads: any[], aiGenerated: any[]): FileReference[] {
  const allDocs = [...(uploads ?? []), ...(aiGenerated ?? [])];
  return allDocs.map(doc => {
    const fileName = doc.file_name || '';
    const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
    return {
      path: doc.file_path,
      name: fileName,
      extension,
      type: 'file' as const,
      relativePath: fileName,
      size: doc.file_size,
      mimeType: doc.mime_type,
    };
  });
}

/**
 * Hook for managing file references (uploaded documents)
 *
 * Shares the same TanStack Query cache as useDocuments — no duplicate requests.
 */
export function useFileReferences({
  selectedProject,
  // authenticatedFetch is no longer used; kept for API compatibility
  onFileReference,
}: UseFileReferencesOptions): UseFileReferencesReturn {
  // 共享 useDocumentsQuery 缓存：同一个 queryKey，只发一次请求
  const { data, isLoading } = useDocumentsQuery(selectedProject ?? null);

  // 将 DocumentListResponse 映射为 FileReference[]
  const files = useMemo(
    () => mapDocumentsToReferences(data?.uploads ?? [], data?.aiGenerated ?? []),
    [data],
  );

  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [atPosition, setAtPosition] = useState(-1);

  useEffect(() => {
    if (showMenu) {
      setSelectedIndex(0);
    }
  }, [showMenu, query]);

  const filteredFiles = useMemo(() => {
    if (!query) return files.slice(0, 20);
    const lowerQuery = query.toLowerCase();
    return files
      .filter(f => f.name.toLowerCase().includes(lowerQuery) || f.relativePath.toLowerCase().includes(lowerQuery))
      .slice(0, 20);
  }, [files, query]);

  const handleFileSelect = useCallback((file: FileReference, index: number, isHover?: boolean) => {
    if (isHover) { setSelectedIndex(index); return; }
    onFileReference?.(file);
  }, [onFileReference]);

  return {
    files, filteredFiles, showMenu, query, selectedIndex,
    atPosition, isLoading, setQuery, setSelectedIndex, setAtPosition,
    setShowMenu, handleFileSelect,
  };
}
