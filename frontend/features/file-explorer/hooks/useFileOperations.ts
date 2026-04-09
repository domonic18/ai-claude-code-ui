import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/shared/services';
import type { FileNode } from '../types/file-explorer.types';
import { findFileByPath, extractRelativePath } from '../utils/fileTreeHelpers';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10000;

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

/**
 * 文件操作 Hook
 * 处理文件增删改查操作
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
    try {
      const response = await api.getFiles(selectedProject.name);
      if (!response.ok) {
        console.error('[FileExplorer] fetchFiles failed:', response.status);
        setFiles([]);
        return;
      }

      const responseData = await response.json();
      const data = responseData.data ?? responseData;
      const filesArray = Array.isArray(data) ? data : [];
      setFiles(filesArray);
    } catch (error) {
      console.error('[FileExplorer] fetchFiles error:', error);
      setFiles([]);
    }
  }, [selectedProject.name, setFiles]);

  const handleDeleteFile = useCallback(async (item: FileNode) => {
    const isDirectory = item.type === 'directory';
    const message = isDirectory
      ? t('fileExplorer.delete.confirmDirectory', { name: item.name })
      : t('fileExplorer.delete.confirmFile', { name: item.name });

    if (!confirm(message)) return;

    setDeletingFile(item.path);

    try {
      const response = await api.deleteFile(selectedProject.name, item.path);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Deletion failed');
      }

      await fetchFiles();
    } catch (error) {
      alert(t('fileExplorer.delete.error', { message: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      setDeletingFile(null);
    }
  }, [selectedProject.name, t, fetchFiles]);

  const handleRenameStart = useCallback((item: FileNode) => {
    setRenamingFile(item.path);
    setEditingName(item.name);
  }, []);

  const handleRenameCancel = useCallback(() => {
    setRenamingFile(null);
    setEditingName('');
  }, []);

  const handleRenameComplete = useCallback(async () => {
    if (!renamingFile || isRenaming) return;

    const trimmedName = editingName.trim();
    if (!trimmedName) {
      alert(t('fileExplorer.rename.nameCannotBeEmpty'));
      return;
    }

    const item = findFileByPath(files, renamingFile);
    if (!item) {
      setRenamingFile(null);
      setEditingName('');
      return;
    }

    const isDirectory = item.type === 'directory';
    const message = isDirectory
      ? t('fileExplorer.rename.confirmDirectory', { oldName: item.name, newName: trimmedName })
      : t('fileExplorer.rename.confirmFile', { oldName: item.name, newName: trimmedName });

    if (!confirm(message)) return;

    setIsRenaming(true);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 10 seconds')), REQUEST_TIMEOUT_MS);
    });

    try {
      const response = await Promise.race([
        api.renameFile(selectedProject.name, item.path, trimmedName),
        timeoutPromise
      ]) as Response;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Rename failed');
      }

      setRenamingFile(null);
      setEditingName('');
      await fetchFiles();
    } catch (error) {
      console.error('[FileExplorer] Rename error:', error);
      alert(t('fileExplorer.rename.error', { message: error instanceof Error ? error.message : 'Unknown error' }));
      setRenamingFile(null);
      setEditingName('');
    } finally {
      setIsRenaming(false);
    }
  }, [renamingFile, isRenaming, editingName, files, selectedProject.name, t, fetchFiles]);

  const handleNewItemClick = useCallback((type: 'folder' | 'file') => {
    setNewItemType(type);
    setNewItemName('');
  }, []);

  const handleNewItemCancel = useCallback(() => {
    setNewItemType(null);
    setNewItemName('');
  }, []);

  const handleNewItemComplete = useCallback(async () => {
    if (isCreating) return;

    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      alert(t('fileExplorer.new.nameRequired'));
      return;
    }

    setIsCreating(true);

    const basePath = selectedFolder
      ? extractRelativePath(selectedFolder.path, selectedProject.name)
      : '.';
    const fullPath = basePath === '.' ? trimmedName : `${basePath}/${trimmedName}`;
    const parentDirPath = selectedFolder?.path || null;

    try {
      if (newItemType === 'folder') {
        const response = await api.createDirectory(selectedProject.name, fullPath);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to create folder');
        }
      } else {
        const response = await api.saveFile(selectedProject.name, fullPath, '\n');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to create file');
        }
      }

      if (parentDirPath && !expandedDirs.has(parentDirPath)) {
        setExpandedDirs(prev => new Set(prev.add(parentDirPath)));
      }

      setNewItemType(null);
      setNewItemName('');
      setSelectedFolder(null);
      await fetchFiles();
    } catch (error) {
      console.error('[FileExplorer] New item error:', error);
      alert(t('fileExplorer.new.error', { message: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, newItemType, newItemName, selectedFolder, selectedProject.name, expandedDirs, t, fetchFiles, setExpandedDirs]);

  return {
    deletingFile,
    renamingFile,
    editingName,
    isRenaming,
    newItemType,
    newItemName,
    isCreating,
    selectedFolder,
    setRenamingFile,
    setEditingName,
    setNewItemType,
    setNewItemName,
    setSelectedFolder,
    handleDeleteFile,
    handleRenameStart,
    handleRenameCancel,
    handleRenameComplete,
    handleNewItemClick,
    handleNewItemCancel,
    handleNewItemComplete,
    fetchFiles
  };
}

export default useFileOperations;
