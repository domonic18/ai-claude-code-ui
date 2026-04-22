/**
 * FileTreeHeaderWrapper.tsx
 *
 * Wrapper component for FileTreeHeader with event handlers
 *
 * @module features/file-explorer/components/FileTreeHeaderWrapper
 */

import React from 'react';
import { FileTreeHeader } from './FileTreeHeader';
import type { FileViewMode } from '../types/file-explorer.types';

interface FileTreeHeaderWrapperProps {
  viewMode: FileViewMode;
  searchQuery: string;
  showNewMenu: boolean;
  newItemType: 'folder' | 'file' | null;
  onViewModeChange: (mode: FileViewMode) => void;
  onSearchChange: (query: string) => void;
  onNewItemClick: (type: 'folder' | 'file') => void;
  onToggleNewMenu: () => void;
  onCloseNewMenu: () => void;
}

// 由父组件调用，React 组件或常量：FileTreeHeaderWrapper
/**
 * File tree header wrapper with event handling
 */
export function FileTreeHeaderWrapper({
  viewMode,
  searchQuery,
  showNewMenu,
  newItemType,
  onViewModeChange,
  onSearchChange,
  onNewItemClick,
  onToggleNewMenu,
  onCloseNewMenu
}: FileTreeHeaderWrapperProps) {
  return (
    <FileTreeHeader
      viewMode={viewMode}
      searchQuery={searchQuery}
      showNewMenu={showNewMenu}
      newItemType={newItemType}
      onViewModeChange={onViewModeChange}
      onSearchChange={onSearchChange}
      onNewItemClick={onNewItemClick}
      onToggleNewMenu={onToggleNewMenu}
      onCloseNewMenu={onCloseNewMenu}
    />
  );
}
