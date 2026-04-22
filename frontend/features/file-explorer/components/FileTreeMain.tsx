/**
 * FileTreeMain.tsx
 *
 * Main layout component for FileTree
 *
 * @module features/file-explorer/components/FileTreeMain
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { FileTreeHeader } from './FileTreeHeader';
import { FileTreeNewItem } from './FileTreeNewItem';
import { FileTreeDetailedHeader } from './FileTreeDetailedHeader';
import { FileTreeContent } from './FileTreeContent';
import type { FileTreeContentProps } from './FileTreeContent';
import { FileTreeModals } from './FileTreeModals';
import type { FileViewMode } from '../types/file-explorer.types';

interface FileTreeMainProps {
  className?: string;
  viewMode: FileViewMode;
  searchQuery: string;
  showNewMenu: boolean;
  filteredFiles: any[];
  headerProps: {
    viewMode: FileViewMode;
    searchQuery: string;
    showNewMenu: boolean;
    newItemType: 'folder' | 'file' | null;
    onViewModeChange: (mode: FileViewMode) => void;
    onSearchChange: (query: string) => void;
    onNewItemClick: (type: 'folder' | 'file') => void;
    onToggleNewMenu: () => void;
    onCloseNewMenu: () => void;
  };
  newItemProps: {
    newItemType: 'folder' | 'file' | null;
    newItemName: string;
    isCreating: boolean;
    selectedFolder: any;
    setItemName: (name: string) => void;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
  };
  contentProps: Partial<FileTreeContentProps>;
  modalsProps: {
    selectedFile: any;
    selectedImage: any;
    onCloseFile: () => void;
    onCloseImage: () => void;
  };
}

// 由父组件调用，React 组件或常量：FileTreeMain
/**
 * File tree main layout
 */
export function FileTreeMain({
  className,
  viewMode,
  filteredFiles,
  headerProps,
  newItemProps,
  contentProps,
  modalsProps
}: FileTreeMainProps) {
  return (
    <div className={cn("h-full flex flex-col bg-card", className)}>
      <FileTreeHeader {...headerProps} />
      <FileTreeNewItem {...newItemProps} />
      {viewMode === 'detailed' && filteredFiles.length > 0 && <FileTreeDetailedHeader />}
      <FileTreeContent {...(contentProps as FileTreeContentProps)} />
      <FileTreeModals {...modalsProps} />
    </div>
  );
}
