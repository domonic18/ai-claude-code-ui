/**
 * File Tree Click Handlers
 *
 * 点击和上下文菜单相关的事件处理器
 *
 * @module features/file-explorer/components/fileTreeClickHandlers
 */

import type { FileNode } from '../types/file-explorer.types';

/**
 * Handle file tree item click
 * @param {FileNode} item - File tree item
 * @param {string | null} renamingFile - File being renamed
 * @param {function} onToggleDirectory - Toggle directory callback
 * @param {function} onSelectFile - Select file callback
 * @param {function} onSelectFolder - Select folder callback
 * @param {React.MouseEvent} e - Mouse event
 */
export function handleItemClick(
  item: FileNode,
  renamingFile: string | null,
  onToggleDirectory: (path: string) => void,
  onSelectFile: (item: FileNode) => void,
  onSelectFolder: (item: FileNode, e: React.MouseEvent) => void,
  e: React.MouseEvent
): void {
  if (renamingFile === item.path) return;
  if ((e.ctrlKey || e.metaKey) && item.type === 'directory') {
    onSelectFolder(item, e);
    return;
  }
  item.type === 'directory' ? onToggleDirectory(item.path) : onSelectFile(item);
}

/**
 * Handle rename button click
 * @param {FileNode} item - File tree item
 * @param {function} onRenameStart - Rename start callback
 * @param {React.MouseEvent} e - Mouse event
 */
export function handleRenameClick(
  item: FileNode,
  onRenameStart: (item: FileNode, e: React.MouseEvent) => void,
  e: React.MouseEvent
): void {
  e.stopPropagation();
  onRenameStart(item, e);
}

/**
 * Handle delete button click
 * @param {FileNode} item - File tree item
 * @param {function} onDelete - Delete callback
 * @param {React.MouseEvent} e - Mouse event
 */
export function handleDeleteClick(
  item: FileNode,
  onDelete: (item: FileNode, e: React.MouseEvent) => void,
  e: React.MouseEvent
): void {
  e.stopPropagation();
  onDelete(item, e);
}
