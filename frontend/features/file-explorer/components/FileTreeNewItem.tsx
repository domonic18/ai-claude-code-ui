/**
 * FileTreeNewItem.tsx
 *
 * New item input section for FileTree
 *
 * @module features/file-explorer/components/FileTreeNewItem
 */

import React from 'react';
import { NewItemInput } from './NewItemInput';
import type { FileNode } from '../types/file-explorer.types';

interface FileTreeNewItemProps {
  newItemType: 'folder' | 'file' | null;
  newItemName: string;
  isCreating: boolean;
  selectedFolder: FileNode | null;
  setItemName: (name: string) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

// 由父组件调用，React 组件或常量：FileTreeNewItem
/**
 * File tree new item input section
 */
export function FileTreeNewItem({
  newItemType,
  newItemName,
  isCreating,
  selectedFolder,
  setItemName,
  onConfirm,
  onCancel
}: FileTreeNewItemProps) {
  if (!newItemType) return null;

  return (
    <div className="px-4 pb-3">
      <NewItemInput
        type={newItemType}
        name={newItemName}
        onChange={setItemName}
        onConfirm={onConfirm}
        onCancel={onCancel}
        selectedFolderName={selectedFolder?.name}
        disabled={isCreating}
      />
    </div>
  );
}
