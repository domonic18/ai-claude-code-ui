/**
 * FileTreeContent.tsx
 *
 * Main content area for FileTree with drag-and-drop support
 *
 * @module features/file-explorer/components/FileTreeContent
 */

import React from 'react';
import { ScrollArea } from '@/shared/components/ui/ScrollArea';
import { cn } from '@/lib/utils';
import { FileTreeViews } from './FileTreeViews';
import { FileTreeEmptyStates } from './FileTreeEmptyStates';
import type { FileNode, FileViewMode } from '../types/file-explorer.types';

export interface FileTreeContentProps {
  files: FileNode[];
  filteredFiles: FileNode[];
  searchQuery: string;
  viewMode: FileViewMode;
  expandedDirs: Set<string>;
  selectedFolder: FileNode | null;
  renamingFile: string | null;
  editingName: string;
  deletingFile: string | null;
  draggingItem: FileNode | null;
  dragOverItem: FileNode | null;
  isDragOverRoot: boolean;
  sizeUnits: string[];
  t: any;
  onToggleDirectory: (path: string) => void;
  onSelectFile: (item: FileNode) => void;
  onSelectFolder: (item: FileNode, e: React.MouseEvent) => void;
  onRenameStart: (item: FileNode) => void;
  onRenameChange: (name: string) => void;
  onRenameConfirm: () => Promise<void>;
  onRenameCancel: () => void;
  onDelete: (item: FileNode) => Promise<void>;
  onDragStart: (item: FileNode, e: React.DragEvent) => void;
  onDragOver: (item: FileNode | null, e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (item: FileNode | null, e: React.DragEvent) => void;
}

// 由父组件调用，React 组件或常量：FileTreeContent
/**
 * File tree main content area
 */
export function FileTreeContent({
  files,
  filteredFiles,
  searchQuery,
  viewMode,
  expandedDirs,
  selectedFolder,
  renamingFile,
  editingName,
  deletingFile,
  draggingItem,
  dragOverItem,
  isDragOverRoot,
  sizeUnits,
  t,
  onToggleDirectory,
  onSelectFile,
  onSelectFolder,
  onRenameStart,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop
}: FileTreeContentProps) {
  return (
    <ScrollArea
      className={cn(
        "flex-1 p-4",
        isDragOverRoot && "bg-blue-50/50"
      )}
      onDragOver={(e) => onDragOver(null, e)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(null, e)}
    >
      {files.length === 0 || (filteredFiles.length === 0 && searchQuery) ? (
        <FileTreeEmptyStates
          filesLength={files.length}
          filteredFilesLength={filteredFiles.length}
          searchQuery={searchQuery}
        />
      ) : (
        <FileTreeViews
          items={filteredFiles}
          viewMode={viewMode}
          expandedDirs={expandedDirs}
          selectedFolder={selectedFolder}
          renamingFile={renamingFile}
          editingName={editingName}
          deletingFile={deletingFile}
          draggingItem={draggingItem}
          dragOverItem={dragOverItem}
          t={t}
          units={sizeUnits}
          onToggleDirectory={onToggleDirectory}
          onSelectFile={onSelectFile}
          onSelectFolder={onSelectFolder}
          onRenameStart={onRenameStart}
          onRenameChange={onRenameChange}
          onRenameConfirm={onRenameConfirm}
          onRenameCancel={onRenameCancel}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      )}
    </ScrollArea>
  );
}
