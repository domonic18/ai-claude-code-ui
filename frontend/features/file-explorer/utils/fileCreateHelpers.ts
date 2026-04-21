/**
 * fileCreateHelpers.ts
 *
 * Helper functions for new file/folder creation operations
 * Extracted from fileOperationsService to reduce complexity
 */

import type { FileNode } from '../types/file-explorer.types';
import { extractRelativePath } from '../utils/fileTreeHelpers';

/**
 * Validate creation preconditions
 * @param isCreating - Whether creation is in progress
 * @param newItemName - Name for the new item
 * @param t - Translation function
 * @returns Trimmed name if valid, null otherwise
 */
export function validateCreatePreconditions(
  isCreating: boolean,
  newItemName: string,
  t: (key: string, params?: any) => string
): string | null {
  if (isCreating) return null;

  const trimmedName = newItemName.trim();
  if (!trimmedName) {
    alert(t('fileExplorer.new.nameRequired'));
    return null;
  }

  return trimmedName;
}

/**
 * Build the full path for a new item
 * @param selectedFolder - Parent folder
 * @param selectedProjectName - Project name
 * @param itemName - Name of new item
 * @returns Full path string
 */
export function buildNewItemPath(
  selectedFolder: FileNode | null,
  selectedProjectName: string,
  itemName: string
): string {
  const basePath = selectedFolder
    ? extractRelativePath(selectedFolder.path, selectedProjectName)
    : '.';
  return basePath === '.' ? itemName : `${basePath}/${itemName}`;
}

/**
 * Ensure parent directory is expanded
 * @param parentDirPath - Parent directory path
 * @param expandedDirs - Current expanded dirs set
 * @param setExpandedDirs - State setter
 */
export function ensureParentExpanded(
  parentDirPath: string | null,
  expandedDirs: Set<string>,
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>
): void {
  if (parentDirPath && !expandedDirs.has(parentDirPath)) {
    setExpandedDirs(prev => new Set(prev.add(parentDirPath)));
  }
}

/**
 * Reset new item creation state
 * @param setNewItemType - State setter
 * @param setNewItemName - State setter
 * @param setSelectedFolder - State setter
 */
export function resetCreateState(
  setNewItemType: (value: 'folder' | 'file' | null) => void,
  setNewItemName: (value: string) => void,
  setSelectedFolder: (value: FileNode | null) => void
): void {
  setNewItemType(null);
  setNewItemName('');
  setSelectedFolder(null);
}
