/**
 * useFileTreeState.ts
 *
 * Custom hook managing all state and effects for the FileTree component
 *
 * @module features/file-explorer/hooks/useFileTreeState
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { filterFileTree, isImageFile } from '../utils/fileTreeHelpers';
import { useFileTreeFetch } from './useFileTreeFetch';
import type { FileNode, FileViewMode, SelectedFile, SelectedImage } from '../types/file-explorer.types';

/**
 * Initialize view mode from localStorage
 */
function useViewModeEffect(
  setViewMode: React.Dispatch<React.SetStateAction<FileViewMode>>
): void {
  useEffect(() => {
    const savedViewMode = localStorage.getItem('file-tree-view-mode');
    if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
      setViewMode(savedViewMode as FileViewMode);
    }
  }, [setViewMode]);
}

/**
 * Filter files based on search query
 */
function useFileFilterEffect(
  files: FileNode[],
  searchQuery: string,
  setFilteredFiles: React.Dispatch<React.SetStateAction<FileNode[]>>
): void {
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const filtered = filterFileTree(files, searchQuery.toLowerCase());
      setFilteredFiles(filtered);
    }
  }, [files, searchQuery, setFilteredFiles]);
}

/**
 * Handle click outside to close new menu
 */
function useClickOutsideEffect(
  showNewMenu: boolean,
  setShowNewMenu: React.Dispatch<React.SetStateAction<boolean>>
): void {
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
  }, [showNewMenu, setShowNewMenu]);
}

/**
 * Create file tree operation handlers
 */
function useFileTreeHandlers(
  selectedProject: { path: string; name: string } | null,
  expandedDirs: Set<string>,
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>,
  setViewMode: React.Dispatch<React.SetStateAction<FileViewMode>>,
  setSelectedFile: React.Dispatch<React.SetStateAction<SelectedFile | null>>,
  setSelectedImage: React.Dispatch<React.SetStateAction<SelectedImage | null>>
) {
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
  }, [setExpandedDirs]);

  // Change view mode and persist to localStorage
  const changeViewMode = useCallback((mode: FileViewMode) => {
    setViewMode(mode);
    localStorage.setItem('file-tree-view-mode', mode);
  }, [setViewMode]);

  // Select folder (Ctrl/Cmd + Click)
  const handleFolderSelect = useCallback((item: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'directory') {
      setSelectedFile(prev => {
        if (prev?.path === item.path) {
          return null;
        } else {
          if (!expandedDirs.has(item.path)) {
            setExpandedDirs(prev => new Set(prev.add(item.path)));
          }
          return {
            name: item.name,
            path: item.path,
            projectPath: selectedProject?.path || '',
            projectName: selectedProject?.name || '',
          };
        }
      });
    }
  }, [expandedDirs, setExpandedDirs, selectedProject, setSelectedFile]);

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
  }, [selectedProject, setSelectedFile, setSelectedImage]);

  return {
    toggleDirectory,
    changeViewMode,
    handleFolderSelect,
    handleSelectFile,
  };
}

/**
 * Initialize file tree state
 */
function useFileTreeStateInit() {
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

  return {
    files,
    setFiles,
    loading,
    setLoading,
    expandedDirs,
    setExpandedDirs,
    selectedFolder,
    setSelectedFolder,
    selectedFile,
    setSelectedFile,
    selectedImage,
    setSelectedImage,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    filteredFiles,
    setFilteredFiles,
    showNewMenu,
    setShowNewMenu,
  };
}

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

// 由组件调用，自定义 Hook：useFileTreeState
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
  const state = useFileTreeStateInit();

  // File fetching
  const { fetchFiles } = useFileTreeFetch({
    selectedProject,
    setFiles: state.setFiles,
    setLoading: state.setLoading,
    setExpandedDirs: state.setExpandedDirs,
  });

  // Effects
  useViewModeEffect(state.setViewMode);
  useFileFilterEffect(state.files, state.searchQuery, state.setFilteredFiles);
  useClickOutsideEffect(state.showNewMenu, state.setShowNewMenu);

  // Handlers
  const handlers = useFileTreeHandlers(
    selectedProject,
    state.expandedDirs,
    state.setExpandedDirs,
    state.setViewMode,
    state.setSelectedFile,
    state.setSelectedImage
  );

  // Size units for display
  const sizeUnits = [
    t('fileExplorer.size.b'),
    t('fileExplorer.size.kb'),
    t('fileExplorer.size.mb'),
    t('fileExplorer.size.gb')
  ];

  return {
    // State
    files: state.files,
    loading: state.loading,
    expandedDirs: state.expandedDirs,
    selectedFolder: state.selectedFolder,
    selectedFile: state.selectedFile,
    selectedImage: state.selectedImage,
    viewMode: state.viewMode,
    searchQuery: state.searchQuery,
    filteredFiles: state.filteredFiles,
    showNewMenu: state.showNewMenu,
    sizeUnits,

    // Setters
    setFiles: state.setFiles,
    setLoading: state.setLoading,
    setExpandedDirs: state.setExpandedDirs,
    setSelectedFolder: state.setSelectedFolder,
    setSelectedFile: state.setSelectedFile,
    setSelectedImage: state.setSelectedImage,
    setSearchQuery: state.setSearchQuery,
    setFilteredFiles: state.setFilteredFiles,
    setShowNewMenu: state.setShowNewMenu,
    setViewMode: state.setViewMode,

    // Handlers
    fetchFiles,
    ...handlers,
  };
}
