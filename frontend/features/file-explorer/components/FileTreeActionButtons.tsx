/**
 * FileTreeActionButtons.tsx
 *
 * Action buttons component for file tree items (rename, delete)
 *
 * @module features/file-explorer/components/FileTreeActionButtons
 */

import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Edit2, Trash2 } from 'lucide-react';
import type { FileNode } from '../types/file-explorer.types';
import { handleRenameClick, handleDeleteClick } from './fileTreeClickHandlers';

export interface FileTreeActionButtonsProps {
  item: FileNode;
  renamingFile: string | null;
  deletingFile: string | null;
  onRenameStart: (item: FileNode, e: React.MouseEvent) => void;
  onDelete: (item: FileNode, e: React.MouseEvent) => void;
}

// Action buttons for rename and delete
export function FileTreeActionButtons({ item, renamingFile, deletingFile, onRenameStart, onDelete }: FileTreeActionButtonsProps) {
  if (renamingFile === item.path) return null;
  return (
    <>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground" onClick={(e) => handleRenameClick(item, onRenameStart, e)}>
        <Edit2 className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground" onClick={(e) => handleDeleteClick(item, onDelete, e)} disabled={deletingFile === item.path}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </>
  );
}
