import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileNode } from '../types/file-explorer.types';
import {
  fetchFilesFromApi,
  deleteFile,
  completeRename,
  completeNewItem
} from '../services/fileOperationsService';

interface UseFileOperationsProps {
  selectedProject: { name: string; path: string };
  files: FileNode[];
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>;
  expandedDirs: Set<string>;
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface UseFileOperationsReturn {
  deletingFile: string | null;
  renamingFile: string | null;
  editingName: string;
  isRenaming: boolean;
  newItemType: 'folder' | 'file' | null;
  newItemName: string;
  isCreating: boolean;
  selectedFolder: FileNode | null;
  setRenamingFile: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingName: React.Dispatch<React.SetStateAction<string>>;
  setNewItemType: React.Dispatch<React.SetStateAction<'folder' | 'file' | null>>;
  setNewItemName: React.Dispatch<React.SetStateAction<string>>;
  setSelectedFolder: React.Dispatch<React.SetStateAction<FileNode | null>>;
  handleDeleteFile: (item: FileNode) => Promise<void>;
  handleRenameStart: (item: FileNode) => void;
  handleRenameCancel: () => void;
  handleRenameComplete: () => Promise<void>;
  handleNewItemClick: (type: 'folder' | 'file') => void;
  handleNewItemCancel: () => void;
  handleNewItemComplete: () => Promise<void>;
  fetchFiles: () => Promise<void>;
}

// 由组件调用，自定义 Hook：useFileOperations
/**
 * 文件操作 Hook
 * 处理文件增删改查操作
 *
 * This hook manages the state for file operations and provides wrapper functions
 * that delegate business logic to the fileOperationsService.
 */
export function useFileOperations({
  selectedProject,
  files,
  setFiles,
  expandedDirs,
  setExpandedDirs
}: UseFileOperationsProps): UseFileOperationsReturn {
  const { t } = useTranslation();
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newItemType, setNewItemType] = useState<'folder' | 'file' | null>(null);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FileNode | null>(null);

  const fetchFiles = useCallback(async () => {
    await fetchFilesFromApi(selectedProject.name, setFiles);
  }, [selectedProject.name, setFiles]);

  const handleDeleteFile = useCallback(async (item: FileNode) => {
    await deleteFile(item, selectedProject.name, t, fetchFiles, setDeletingFile);
  }, [selectedProject.name, t, fetchFiles]);

  const handleRenameComplete = useCallback(async () => {
    await completeRename(
      renamingFile, isRenaming, editingName, files, selectedProject.name, t,
      fetchFiles, setRenamingFile, setEditingName, setIsRenaming
    );
  }, [renamingFile, isRenaming, editingName, files, selectedProject.name, t, fetchFiles]);

  const handleRenameStart = useCallback((item: FileNode) => {
    setRenamingFile(item.path);
    setEditingName(item.name);
  }, []);

  const handleRenameCancel = useCallback(() => {
    setRenamingFile(null);
    setEditingName('');
  }, []);

  const handleNewItemClick = useCallback((type: 'folder' | 'file') => {
    setNewItemType(type);
    setNewItemName('');
  }, []);

  const handleNewItemCancel = useCallback(() => {
    setNewItemType(null);
    setNewItemName('');
  }, []);

  const handleNewItemComplete = useCallback(async () => {
    await completeNewItem(
      isCreating, newItemType, newItemName, selectedFolder, selectedProject.name,
      expandedDirs, t, fetchFiles, setExpandedDirs, setNewItemType, setNewItemName,
      setSelectedFolder, setIsCreating
    );
  }, [isCreating, newItemType, newItemName, selectedFolder, selectedProject.name, expandedDirs, t, fetchFiles, setExpandedDirs]);

  return {
    deletingFile, renamingFile, editingName, isRenaming,
    newItemType, newItemName, isCreating, selectedFolder,
    setRenamingFile, setEditingName, setNewItemType, setNewItemName, setSelectedFolder,
    handleDeleteFile, handleRenameStart, handleRenameCancel, handleRenameComplete,
    handleNewItemClick, handleNewItemCancel, handleNewItemComplete, fetchFiles
  };
}

export default useFileOperations;
