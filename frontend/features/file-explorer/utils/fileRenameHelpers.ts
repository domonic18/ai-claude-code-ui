/**
 * fileRenameHelpers.ts
 *
 * Helper functions for file rename operations
 * Extracted from fileOperationsService to reduce complexity
 */

import type { FileNode } from '../types/file-explorer.types';
import { findFileByPath } from '../utils/fileTreeHelpers';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Validate rename preconditions and return the file item if valid
 * @param renamingFile - Path of file being renamed
 * @param isRenaming - Whether rename operation is in progress
 * @param editingName - New name for the file
 * @param files - Current file tree
 * @param t - Translation function
 * @returns File item to rename, or null if validation failed
 */
export function validateRenamePreconditions(
  renamingFile: string | null,
  isRenaming: boolean,
  editingName: string,
  files: FileNode[],
  t: (key: string, params?: any) => string,
  resetState: () => void
): FileNode | null {
  if (!renamingFile || isRenaming) return null;

  const trimmedName = editingName.trim();
  if (!trimmedName) {
    alert(t('fileExplorer.rename.nameCannotBeEmpty'));
    return null;
  }

  const item = findFileByPath(files, renamingFile);
  if (!item) {
    resetState();
    return null;
  }

  return item;
}

/**
 * Get confirmation message for rename operation
 * @param item - File node being renamed
 * @param newName - New name
 * @param t - Translation function
 * @returns true if user confirmed
 */
export function confirmRename(item: FileNode, newName: string, t: (key: string, params?: any) => string): boolean {
  const isDirectory = item.type === 'directory';
  const message = isDirectory
    ? t('fileExplorer.rename.confirmDirectory', { oldName: item.name, newName })
    : t('fileExplorer.rename.confirmFile', { oldName: item.name, newName });
  return confirm(message);
}

/**
 * Create a timeout promise for API requests
 * @returns Promise that rejects after timeout
 */
export function createTimeoutPromise(): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 10 seconds')), REQUEST_TIMEOUT_MS);
  });
}

/**
 * Reset rename state to defaults
 * @param setRenamingFile - State setter
 * @param setEditingName - State setter
 */
export function resetRenameState(
  setRenamingFile: (value: string | null) => void,
  setEditingName: (value: string) => void
): void {
  setRenamingFile(null);
  setEditingName('');
}
