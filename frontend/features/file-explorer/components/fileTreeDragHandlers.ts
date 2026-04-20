/**
 * File Tree Drag Handlers
 *
 * 拖放相关的事件处理器
 *
 * @module features/file-explorer/components/fileTreeDragHandlers
 */

import type { FileNode } from '../types/file-explorer.types';

/**
 * Get container class name with drag-over state
 * @param {FileNode} item - File tree item
 * @param {FileNode | null} dragOverItem - Item being dragged over
 * @returns {string} Container class name
 */
export function getContainerClassName(item: FileNode, dragOverItem: FileNode | null): string {
  const baseClasses = 'select-none group/file rounded-md relative';
  const dragOverClasses = dragOverItem?.path === item.path && item.type === 'directory' ? 'ring-2 ring-blue-400 bg-blue-50/50' : '';
  return `${baseClasses} ${dragOverClasses}`;
}

/**
 * Handle drag start event
 * @param {FileNode} item - Item being dragged
 * @param {function} onDragStart - Drag start callback
 * @param {React.DragEvent} e - Drag event
 */
export function handleDragStart(item: FileNode, onDragStart: (item: FileNode, e: React.DragEvent) => void, e: React.DragEvent): void {
  e.stopPropagation();
  onDragStart(item, e);
}

/**
 * Handle drag over event
 * @param {FileNode} item - Item being dragged over
 * @param {function} onDragOver - Drag over callback
 * @param {React.DragEvent} e - Drag event
 */
export function handleDragOver(item: FileNode, onDragOver: (item: FileNode | null, e: React.DragEvent) => void, e: React.DragEvent): void {
  e.stopPropagation();
  onDragOver(item, e);
}

/**
 * Handle drop event
 * @param {FileNode | null} item - Drop target item
 * @param {function} onDrop - Drop callback
 * @param {React.DragEvent} e - Drag event
 */
export function handleDrop(item: FileNode | null, onDrop: (item: FileNode | null, e: React.DragEvent) => void, e: React.DragEvent): void {
  onDrop(item, e);
}
