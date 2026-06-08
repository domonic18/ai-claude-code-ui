/**
 * useFileReferences Hook
 *
 * Manages file reference functionality with @ symbol.
 * Loads uploaded documents from DocumentService API.
 *
 * Features:
 * - Detect @ symbol in input
 * - Load and filter documents from project uploads
 * - Keyboard navigation
 * - File reference insertion as attachment
 */

import { useState, useCallback, useEffect } from 'react';
import { logger } from '@/shared/utils/logger';

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
 * Map document items from DocumentService API to FileReference objects
 * @param docs - Array of document items from GET /api/projects/{name}/documents
 * @returns FileReference array
 */
function mapDocumentsToReferences(docs: any[]): FileReference[] {
  return docs.map(doc => {
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

  useEffect(() => {
    if (showMenu) {
      setSelectedIndex(0);
    }
  }, [showMenu, query]);

  const loadFiles = useCallback(async () => {
    if (!selectedProject || !authenticatedFetch) return;
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(
        `/api/projects/${encodeURIComponent(selectedProject)}/documents`
      );
      if (!response.ok) throw new Error('Failed to load documents');

      const json = await response.json();
      const data = json.data || json;
      // Combine uploads and AI-generated documents
      const uploads = Array.isArray(data.uploads) ? data.uploads : [];
      const aiGenerated = Array.isArray(data.aiGenerated) ? data.aiGenerated : [];
      const allDocs = [...uploads, ...aiGenerated];

      setFiles(mapDocumentsToReferences(allDocs));
    } catch (error) {
      logger.error('Failed to load documents:', error);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject, authenticatedFetch]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const filteredFiles = useCallback(() => {
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
    files, filteredFiles: filteredFiles(), showMenu, query, selectedIndex,
    atPosition, isLoading, setQuery, setSelectedIndex, setAtPosition,
    setShowMenu, handleFileSelect,
  };
}
