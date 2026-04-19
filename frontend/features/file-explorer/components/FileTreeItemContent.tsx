/**
 * FileTreeItemContent.tsx
 *
 * Content renderer for FileTreeItem button
 *
 * @module features/file-explorer/components/FileTreeItemContent
 */

import React from 'react';
import { Folder, FolderOpen, File, FileCode, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { RenameInput } from './RenameInput';
import { Edit2, Trash2 } from 'lucide-react';
import type { FileNode } from '../types/file-explorer.types';

/**
 * Get file icon based on filename extension
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
 * FileTreeItemActionButtons Component
 *
 * Renders the action buttons for rename and delete.
 */
interface FileTreeItemActionButtonsProps {
  onRenameStart: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}

function FileTreeItemActionButtons({
  onRenameStart,
  onDelete,
  isDeleting,
}: FileTreeItemActionButtonsProps): JSX.Element {
  return (
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
  );
}

/**
 * Props for FileTreeItemContent component
 */
export interface FileTreeItemContentProps {
  item: FileNode;
  isExpanded: boolean;
  isRenaming: boolean;
  renameValue: string;
  isDeleting: boolean;
  level: number;
  isSelected: boolean;
  isDragging: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onRenameStart: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onRenameChange: (value: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

/**
 * FileTreeItemContent Component
 *
 * Renders the button content for a file tree item.
 */
export function FileTreeItemContent({
  item,
  isExpanded,
  isRenaming,
  renameValue,
  isDeleting,
  level,
  isSelected,
  isDragging,
  onToggle,
  onSelect,
  onRenameStart,
  onDelete,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDrop,
}: FileTreeItemContentProps): JSX.Element {
  const isDirectory = item.type === 'directory';

  return (
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
          <FileTreeItemActionButtons
            onRenameStart={onRenameStart}
            onDelete={onDelete}
            isDeleting={isDeleting}
          />
        )}
      </div>
    </Button>
  );
}

export default FileTreeItemContent;
