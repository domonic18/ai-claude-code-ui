/**
 * FileTreeProps.ts
 *
 * Helper functions to construct props for FileTree sub-components
 *
 * @module features/file-explorer/components/FileTreeProps
 */

import type { FileViewMode } from '../types/file-explorer.types';

interface State {
  viewMode: FileViewMode;
  searchQuery: string;
  showNewMenu: boolean;
  filteredFiles: any[];
  selectedFolder: any;
  files: any[];
  expandedDirs: Set<string>;
  sizeUnits: string[];
  selectedFile: any;
  selectedImage: any;
  changeViewMode: (mode: FileViewMode) => void;
  setSearchQuery: (query: string) => void;
  setShowNewMenu: (show: boolean) => void;
  setSelectedFile: (file: any) => void;
  setSelectedImage: (image: any) => void;
  toggleDirectory: (path: string) => void;
  handleSelectFile: (item: any) => void;
  handleFolderSelect: (item: any, e: React.MouseEvent) => void;
}

interface Ops {
  newItemType: 'folder' | 'file' | null;
  newItemName: string;
  isCreating: boolean;
  renamingFile: string | null;
  editingName: string;
  deletingFile: string | null;
  setNewItemName: (name: string) => void;
  handleNewItemClick: (type: 'folder' | 'file') => void;
  handleNewItemComplete: () => Promise<void>;
  handleNewItemCancel: () => void;
  handleRenameStart: (item: any) => void;
  setEditingName: (name: string) => void;
  handleRenameComplete: () => Promise<void>;
  handleRenameCancel: () => void;
  handleDeleteFile: (item: any) => Promise<void>;
}

interface Dnd {
  draggingItem: any;
  dragOverItem: any;
  isDragOverRoot: boolean;
  handleDragStart: (item: any, e: React.DragEvent) => void;
  handleDragOver: (item: any | null, e: React.DragEvent) => void;
  handleScrollAreaDragLeave: () => void;
  handleDrop: (item: any | null, e: React.DragEvent) => void;
}

/**
 * Build header props for FileTreeHeader
 */
export function buildHeaderProps(
  state: State,
  ops: Ops
) {
  return {
    viewMode: state.viewMode,
    searchQuery: state.searchQuery,
    showNewMenu: state.showNewMenu,
    newItemType: ops.newItemType,
    onViewModeChange: state.changeViewMode,
    onSearchChange: state.setSearchQuery,
    onNewItemClick: (type: 'folder' | 'file') => {
      ops.handleNewItemClick(type);
      state.setShowNewMenu(false);
    },
    onToggleNewMenu: () => state.setShowNewMenu(!state.showNewMenu),
    onCloseNewMenu: () => state.setShowNewMenu(false)
  };
}

/**
 * Build new item props for FileTreeNewItem
 */
export function buildNewItemProps(
  state: State,
  ops: Ops
) {
  return {
    newItemType: ops.newItemType,
    newItemName: ops.newItemName,
    isCreating: ops.isCreating,
    selectedFolder: state.selectedFolder,
    setItemName: ops.setNewItemName,
    onConfirm: ops.handleNewItemComplete,
    onCancel: ops.handleNewItemCancel
  };
}

/**
 * Build content props for FileTreeContent
 */
export function buildContentProps(
  state: State,
  ops: Ops,
  dnd: Dnd,
  t: any
) {
  return {
    files: state.files,
    filteredFiles: state.filteredFiles,
    searchQuery: state.searchQuery,
    viewMode: state.viewMode,
    expandedDirs: state.expandedDirs,
    selectedFolder: state.selectedFolder,
    renamingFile: ops.renamingFile,
    editingName: ops.editingName,
    deletingFile: ops.deletingFile,
    draggingItem: dnd.draggingItem,
    dragOverItem: dnd.dragOverItem,
    isDragOverRoot: dnd.isDragOverRoot,
    sizeUnits: state.sizeUnits,
    t,
    onToggleDirectory: state.toggleDirectory,
    onSelectFile: state.handleSelectFile,
    onSelectFolder: state.handleFolderSelect,
    onRenameStart: ops.handleRenameStart,
    onRenameChange: ops.setEditingName,
    onRenameConfirm: ops.handleRenameComplete,
    onRenameCancel: ops.handleRenameCancel,
    onDelete: ops.handleDeleteFile,
    onDragStart: dnd.handleDragStart,
    onDragOver: dnd.handleDragOver,
    onDragLeave: dnd.handleScrollAreaDragLeave,
    onDrop: dnd.handleDrop
  };
}

/**
 * Build modals props for FileTreeModals
 */
export function buildModalsProps(state: State) {
  return {
    selectedFile: state.selectedFile,
    selectedImage: state.selectedImage,
    onCloseFile: () => state.setSelectedFile(null),
    onCloseImage: () => state.setSelectedImage(null)
  };
}
