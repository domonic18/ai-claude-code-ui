/**
 * fileOperationsService.ts
 *
 * Service layer for file operations
 * Contains business logic for file CRUD operations separated from React hooks
 */

import { api } from '@/shared/services';
import type { FileNode } from '../types/file-explorer.types';
import { handleApiResponse, extractErrorMessage } from '../utils/fileApiHelpers';
import { logger } from '@/shared/utils/logger';
import {
  validateRenamePreconditions,
  confirmRename,
  createTimeoutPromise,
  resetRenameState,
} from '../utils/fileRenameHelpers';
import {
  validateCreatePreconditions,
  buildNewItemPath,
  ensureParentExpanded,
  resetCreateState,
} from '../utils/fileCreateHelpers';

/**
 * Fetches files from the API for the selected project
 * @param selectedProjectName - Selected project name
 * @param setFiles - State setter for files
 * @returns Promise that resolves when files are fetched
 */
export async function fetchFilesFromApi(
  selectedProjectName: string,
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>
): Promise<void> {
  try {
    const response = await api.getFiles(selectedProjectName);
    if (!response.ok) {
      logger.error('[FileExplorer] fetchFiles failed:', response.status);
      setFiles([]);
      return;
    }
    const responseData = await response.json();
    const data = responseData.data ?? responseData;
    const filesArray = Array.isArray(data) ? data : [];
    setFiles(filesArray);
  } catch (error) {
    logger.error('[FileExplorer] fetchFiles error:', error);
    setFiles([]);
  }
}

/**
 * Deletes a file or directory
 * @param item - File node to delete
 * @param selectedProjectName - Selected project name
 * @param t - Translation function
 * @param fetchFiles - Function to refresh file list
 * @param setDeletingFile - State setter for deleting file path
 */
export async function deleteFile(
  item: FileNode,
  selectedProjectName: string,
  t: (key: string, params?: any) => string,
  fetchFiles: () => Promise<void>,
  setDeletingFile: (value: string | null) => void
): Promise<void> {
  const isDirectory = item.type === 'directory';
  const message = isDirectory
    ? t('fileExplorer.delete.confirmDirectory', { name: item.name })
    : t('fileExplorer.delete.confirmFile', { name: item.name });
  if (!confirm(message)) return;

  setDeletingFile(item.path);

  try {
    const response = await api.deleteFile(selectedProjectName, item.path);
    await handleApiResponse(response, 'Deletion failed');
    await fetchFiles();
  } catch (error) {
    const msg = extractErrorMessage(error, 'Unknown error');
    alert(t('fileExplorer.delete.error', { message: msg }));
  } finally {
    setDeletingFile(null);
  }
}

/**
 * Completes file/folder rename operation
 * @param renamingFile - Path of file being renamed
 * @param isRenaming - Whether rename operation is in progress
 * @param editingName - New name for the file
 * @param files - Current file tree
 * @param selectedProjectName - Selected project name
 * @param t - Translation function
 * @param fetchFiles - Function to refresh file list
 * @param setRenamingFile - State setter for renaming file path
 * @param setEditingName - State setter for editing name
 * @param setIsRenaming - State setter for rename progress
 */
export async function completeRename(
  renamingFile: string | null,
  isRenaming: boolean,
  editingName: string,
  files: FileNode[],
  selectedProjectName: string,
  t: (key: string, params?: any) => string,
  fetchFiles: () => Promise<void>,
  setRenamingFile: (value: string | null) => void,
  setEditingName: (value: string) => void,
  setIsRenaming: (value: boolean) => void
): Promise<void> {
  const trimmedName = editingName.trim();
  const item = validateRenamePreconditions(
    renamingFile, isRenaming, editingName, files, t,
    () => resetRenameState(setRenamingFile, setEditingName)
  );
  if (!item) return;

  if (!confirmRename(item, trimmedName, t)) return;

  setIsRenaming(true);

  try {
    const response = await Promise.race([
      api.renameFile(selectedProjectName, item.path, trimmedName),
      createTimeoutPromise()
    ]) as Response;

    await handleApiResponse(response, 'Rename failed');
    resetRenameState(setRenamingFile, setEditingName);
    await fetchFiles();
  } catch (error) {
    logger.error('[FileExplorer] Rename error:', error);
    const msg = extractErrorMessage(error, 'Unknown error');
    alert(t('fileExplorer.rename.error', { message: msg }));
    resetRenameState(setRenamingFile, setEditingName);
  } finally {
    setIsRenaming(false);
  }
}

/**
 * Completes new file/folder creation operation
 * @param isCreating - Whether creation operation is in progress
 * @param newItemType - Type of item being created ('folder' | 'file' | null)
 * @param newItemName - Name for the new item
 * @param selectedFolder - Parent folder for the new item
 * @param selectedProjectName - Selected project name
 * @param expandedDirs - Set of expanded directory paths
 * @param t - Translation function
 * @param fetchFiles - Function to refresh file list
 * @param setExpandedDirs - State setter for expanded directories
 * @param setNewItemType - State setter for new item type
 * @param setNewItemName - State setter for new item name
 * @param setSelectedFolder - State setter for selected folder
 * @param setIsCreating - State setter for creation progress
 */
export async function completeNewItem(
  isCreating: boolean,
  newItemType: 'folder' | 'file' | null,
  newItemName: string,
  selectedFolder: FileNode | null,
  selectedProjectName: string,
  expandedDirs: Set<string>,
  t: (key: string, params?: any) => string,
  fetchFiles: () => Promise<void>,
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>,
  setNewItemType: (value: 'folder' | 'file' | null) => void,
  setNewItemName: (value: string) => void,
  setSelectedFolder: (value: FileNode | null) => void,
  setIsCreating: (value: boolean) => void
): Promise<void> {
  const trimmedName = validateCreatePreconditions(isCreating, newItemName, t);
  if (!trimmedName) return;

  setIsCreating(true);

  const fullPath = buildNewItemPath(selectedFolder, selectedProjectName, trimmedName);
  const parentDirPath = selectedFolder?.path || null;

  try {
    if (newItemType === 'folder') {
      const response = await api.createDirectory(selectedProjectName, fullPath);
      await handleApiResponse(response, 'Failed to create folder');
    } else {
      const response = await api.saveFile(selectedProjectName, fullPath, '\n');
      await handleApiResponse(response, 'Failed to create file');
    }

    ensureParentExpanded(parentDirPath, expandedDirs, setExpandedDirs);
    resetCreateState(setNewItemType, setNewItemName, setSelectedFolder);
    await fetchFiles();
  } catch (error) {
    logger.error('[FileExplorer] New item error:', error);
    const msg = extractErrorMessage(error, 'Unknown error');
    alert(t('fileExplorer.new.error', { message: msg }));
  } finally {
    setIsCreating(false);
  }
}
