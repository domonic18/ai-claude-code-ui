/**
 * useFileTreeState.ts
 *
 * Custom hook managing all state and effects for the FileTree component
 *
 * @module features/file-explorer/hooks/useFileTreeState
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/shared/services';
import { filterFileTree, isImageFile } from '../utils/fileTreeHelpers';
import { logger } from '@/shared/utils/logger';
import type { FileNode, FileViewMode, SelectedFile, SelectedImage } from '../types/file-explorer.types';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10000;

interface UseFileTreeStateReturn {
  // State
  files: FileNode[];
  loading: boolean;
  expandedDirs: Set<string>;
  selectedFolder: FileNode | null;
  selectedFile: SelectedFile | null;
  selectedImage: SelectedImage | null;
  viewMode: FileViewMode;
  searchQuery: string;
  filteredFiles: FileNode[];
  showNewMenu: boolean;
  sizeUnits: string[];

  // Setters
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedFolder: React.Dispatch<React.SetStateAction<FileNode | null>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<SelectedFile | null>>;
  setSelectedImage: React.Dispatch<React.SetStateAction<SelectedImage | null>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setFilteredFiles: React.Dispatch<React.SetStateAction<FileNode[]>>;
  setShowNewMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setViewMode: React.Dispatch<React.SetStateAction<FileViewMode>>;

  // Handlers
  fetchFiles: () => Promise<void>;
  toggleDirectory: (path: string) => void;
  changeViewMode: (mode: FileViewMode) => void;
  handleFolderSelect: (item: FileNode, e: React.MouseEvent) => void;
  handleSelectFile: (item: FileNode) => void;
}

/**
 * Custom hook managing all state and effects for the FileTree component
 *
 * @param {Object} params - Hook parameters
 * @param {Object} params.selectedProject - Currently selected project
 * @returns {UseFileTreeStateReturn} State, setters, and handlers
 */
export function useFileTreeState({
  selectedProject
}: {
  selectedProject: { path: string; name: string } | null;
}): UseFileTreeStateReturn {
  const { t } = useTranslation();

  // State
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<FileNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [viewMode, setViewMode] = useState<FileViewMode>('detailed');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredFiles, setFilteredFiles] = useState<FileNode[]>([]);
  const [showNewMenu, setShowNewMenu] = useState(false);

  // Fetch files from API
  const fetchFiles = useCallback(async () => {
    if (!selectedProject) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const data = await api.fileTree.listFiles(
        selectedProject.path,
        controller.signal
      );
      clearTimeout(timeoutId);

      setFiles(data.files || []);
      logger.info('FileTree: Files loaded', {
        projectId: selectedProject.path,
        count: data.files?.length || 0
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('FileTree: Request timeout', { projectId: selectedProject.path });
      } else {
        logger.error('FileTree: Failed to load files', {
          projectId: selectedProject.path,
          error
        });
      }
      setFiles([]);
    }
  }, [selectedProject]);

  // Load files when project changes
  useEffect(() => {
    if (selectedProject) {
      setLoading(true);
      fetchFiles().finally(() => setLoading(false));
    }
  }, [selectedProject, fetchFiles]);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('file-tree-view-mode');
    if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
      setViewMode(savedViewMode as FileViewMode);
    }
  }, []);

  // Filter files based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const filtered = filterFileTree(files, searchQuery.toLowerCase());
      setFilteredFiles(filtered);
    }
  }, [files, searchQuery]);

  // Click outside to close new menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNewMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.new-menu-container') && !target.closest('[data-new-menu-trigger]')) {
          setShowNewMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewMenu]);

  // Toggle directory expansion
  const toggleDirectory = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Change view mode and persist to localStorage
  const changeViewMode = useCallback((mode: FileViewMode) => {
    setViewMode(mode);
    localStorage.setItem('file-tree-view-mode', mode);
  }, []);

  // Select folder (Ctrl/Cmd + Click)
  const handleFolderSelect = useCallback((item: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'directory') {
      if (selectedFolder?.path === item.path) {
        setSelectedFolder(null);
      } else {
        setSelectedFolder(item);
        if (!expandedDirs.has(item.path)) {
          setExpandedDirs(prev => new Set(prev.add(item.path)));
        }
      }
    }
  }, [selectedFolder, expandedDirs]);

  // Select file for editing or viewing
  const handleSelectFile = useCallback((item: FileNode) => {
    if (!selectedProject) return;

    if (isImageFile(item.name)) {
      setSelectedImage({
        name: item.name,
        path: item.path,
        projectPath: selectedProject.path,
        projectName: selectedProject.name
      });
    } else {
      setSelectedFile({
        name: item.name,
        path: item.path,
        projectPath: selectedProject.path,
        projectName: selectedProject.name
      });
    }
  }, [selectedProject]);

  // Size units for display
  const sizeUnits = [
    t('fileExplorer.size.b'),
    t('fileExplorer.size.kb'),
    t('fileExplorer.size.mb'),
    t('fileExplorer.size.gb')
  ];

  return {
    // State
    files,
    loading,
    expandedDirs,
    selectedFolder,
    selectedFile,
    selectedImage,
    viewMode,
    searchQuery,
    filteredFiles,
    showNewMenu,
    sizeUnits,

    // Setters
    setFiles,
    setLoading,
    setExpandedDirs,
    setSelectedFolder,
    setSelectedFile,
    setSelectedImage,
    setSearchQuery,
    setFilteredFiles,
    setShowNewMenu,
    setViewMode,

    // Handlers
    fetchFiles,
    toggleDirectory,
    changeViewMode,
    handleFolderSelect,
    handleSelectFile
  };
}
