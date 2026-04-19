/**
 * FileTreeItem.tsx
 *
 * Individual file/directory item component for file tree
 *
 * @module features/file-explorer/components/FileTreeItem
 */

import React from 'react';
import { FileTreeItemContent } from './FileTreeItemContent';
import type { FileNode } from '../types/file-explorer.types';

/**
 * Props for FileTreeItem component
 */
export interface FileTreeItemProps {
  item: FileNode;
  isExpanded: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  renameValue: string;
  isDeleting: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  level: number;
  onToggle: () => void;
  onSelect: () => void;
  onRenameStart: (e: React.MouseEvent) => void;
  onRenameChange: (value: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

/**
 * File tree item component
 * Displays a single file or folder with actions
 *
 * @param {FileTreeItemProps} props - Component props
 * @returns {JSX.Element} File tree item component
 */
export function FileTreeItem({
  item,
  isDragging,
  isDragOver,
  ...contentProps
}: FileTreeItemProps) {
  return (
    <div
      className={`
        select-none group rounded-md
        ${isDragOver ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
      `}
    >
      <FileTreeItemContent
        item={item}
        isDragging={isDragging}
        {...contentProps}
      />
    </div>
  );
}

export default FileTreeItem;
