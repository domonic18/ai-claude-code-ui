/**
 * FileTreeItem.tsx
 *
 * Individual file/directory item component for file tree
 *
 * @module features/file-explorer/components/FileTreeItem
 */

import React from 'react';
import { Folder, FolderOpen, File, FileCode, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { RenameInput } from './RenameInput';
import { Edit2, Trash2 } from 'lucide-react';
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
 * Get file icon based on filename extension
 *
 * @param {string} filename - The filename to get icon for
 * @returns {React.ReactNode} File icon component
 */
function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase();

  const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
  const docExtensions = ['md', 'txt', 'doc', 'pdf'];

  if (codeExtensions.includes(ext || '')) {
    return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
  } else if (docExtensions.includes(ext || '')) {
    return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
  return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
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
  isExpanded,
  isSelected,
  isRenaming,
  renameValue,
  isDeleting,
  isDragging,
  isDragOver,
  level,
  onToggle,
  onSelect,
  onRenameStart,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop
}: FileTreeItemProps) {
  const isDirectory = item.type === 'directory';

  return (
    <div
      className={`
        select-none group rounded-md
        ${isDragOver ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
      `}
    >
      <Button
        variant="ghost"
        className={`
          w-full justify-start p-2 h-auto font-normal text-left hover:bg-accent
          ${isSelected ? 'bg-accent/50' : ''}
          ${isDragging ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        draggable={!isRenaming}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={(e) => {
          if (isRenaming) return;
          if (isDirectory) {
            onToggle();
          } else {
            onSelect();
          }
        }}
      >
        <div className="flex items-center justify-between gap-2 min-w-0 w-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isDirectory ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}

            {isRenaming ? (
              <RenameInput
                value={renameValue}
                onChange={onRenameChange}
                onConfirm={onRenameConfirm}
                onCancel={onRenameCancel}
                width="w-32"
              />
            ) : (
              <span className="text-sm truncate text-foreground">
                {item.name}
              </span>
            )}
          </div>

          {!isRenaming && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
                onClick={onRenameStart}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={onDelete}
                disabled={isDeleting}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </Button>
    </div>
  );
}

export default FileTreeItem;
