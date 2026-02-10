/**
 * FileTree.tsx
 *
 * File tree component displaying project structure with file operations and multiple view modes
 *
 * @module features/file-explorer/components/FileTree
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/shared/components/ui/ScrollArea';
import { Folder, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeEditor } from '@/features/editor';
import ImageViewer from '@/shared/components/common/ImageViewer';
import { FileTreeHeader } from './FileTreeHeader';
import { FileTreeViews } from './FileTreeViews';
import { NewItemInput } from './NewItemInput';
import { useFileOperations } from '../hooks/useFileOperations';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { filterFileTree, isImageFile } from '../utils/fileTreeHelpers';
import type {
  FileTreeComponentProps,
  FileNode,
  FileViewMode,
  SelectedFile,
  SelectedImage
} from '../types/file-explorer.types';

/**
 * File tree component
 * Displays project file structure with file operations and multiple view modes
 *
 * @param {FileTreeComponentProps} props - Component props
 * @returns {JSX.Element} File tree component
 */
function FileTree({ selectedProject, className = '' }: FileTreeComponentProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [viewMode, setViewMode] = useState<FileViewMode>('detailed');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredFiles, setFilteredFiles] = useState<FileNode[]>([]);
  const [showNewMenu, setShowNewMenu] = useState(false);

  // 文件操作 hook
  const {
    deletingFile,
    renamingFile,
    editingName,
    isRenaming,
    newItemType,
    newItemName,
    isCreating,
    selectedFolder,
    setRenamingFile,
    setEditingName,
    setNewItemType,
    setNewItemName,
    setSelectedFolder,
    handleDeleteFile,
    handleRenameStart,
    handleRenameCancel,
    handleRenameComplete,
    handleNewItemClick,
    handleNewItemCancel,
    handleNewItemComplete,
    fetchFiles
  } = useFileOperations({
    selectedProject,
    files,
    setFiles,
    expandedDirs,
    setExpandedDirs
  });

  // 拖拽操作 hook
  const {
    draggingItem,
    dragOverItem,
    isDragOverRoot,
    handleDragStart,
    handleDragOver,
    handleScrollAreaDragLeave,
    handleDrop
  } = useDragAndDrop({
    selectedProject,
    files,
    fetchFiles
  });

  // 加载文件列表
  useEffect(() => {
    if (selectedProject) {
      setLoading(true);
      fetchFiles().finally(() => setLoading(false));
    }
  }, [selectedProject, fetchFiles]);

  // 从 localStorage 加载视图模式偏好
  useEffect(() => {
    const savedViewMode = localStorage.getItem('file-tree-view-mode');
    if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
      setViewMode(savedViewMode as FileViewMode);
    }
  }, []);

  // 根据搜索查询过滤文件
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const filtered = filterFileTree(files, searchQuery.toLowerCase());
      setFilteredFiles(filtered);
    }
  }, [files, searchQuery]);

  // 点击外部关闭新建菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNewMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.new-menu-container') && !target.closest('[data-new-menu-trigger]')) {
          setShowNewMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewMenu]);

  // 切换目录展开状态
  const toggleDirectory = (path: string) => {
    setExpandedDirs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // 更改视图模式
  const changeViewMode = (mode: FileViewMode) => {
    setViewMode(mode);
    localStorage.setItem('file-tree-view-mode', mode);
  };

  // 选择文件夹 (Ctrl/Cmd + Click)
  const handleFolderSelect = (item: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'directory') {
      if (selectedFolder?.path === item.path) {
        setSelectedFolder(null);
      } else {
        setSelectedFolder(item);
        if (!expandedDirs.has(item.path)) {
          setExpandedDirs(prev => new Set(prev.add(item.path)));
        }
      }
    }
  };

  // 选择文件
  const handleSelectFile = (item: FileNode) => {
    if (isImageFile(item.name)) {
      setSelectedImage({
        name: item.name,
        path: item.path,
        projectPath: selectedProject.path,
        projectName: selectedProject.name
      });
    } else {
      setSelectedFile({
        name: item.name,
        path: item.path,
        projectPath: selectedProject.path,
        projectName: selectedProject.name
      });
    }
  };

  // 大小单位
  const sizeUnits = [
    t('fileExplorer.size.b'),
    t('fileExplorer.size.kb'),
    t('fileExplorer.size.mb'),
    t('fileExplorer.size.gb')
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          {t('fileExplorer.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col bg-card", className)}>
      <FileTreeHeader
        viewMode={viewMode}
        searchQuery={searchQuery}
        showNewMenu={showNewMenu}
        newItemType={newItemType}
        onViewModeChange={changeViewMode}
        onSearchChange={setSearchQuery}
        onNewItemClick={(type) => {
          handleNewItemClick(type);
          setShowNewMenu(false);
        }}
        onToggleNewMenu={() => setShowNewMenu(!showNewMenu)}
        onCloseNewMenu={() => setShowNewMenu(false)}
      />

      {/* New folder/file input */}
      {newItemType && (
        <div className="px-4 pb-3">
          <NewItemInput
            type={newItemType}
            name={newItemName}
            onChange={setNewItemName}
            onConfirm={handleNewItemComplete}
            onCancel={handleNewItemCancel}
            selectedFolderName={selectedFolder?.name}
            disabled={isCreating}
          />
        </div>
      )}

      {/* Column Headers for Detailed View */}
      {viewMode === 'detailed' && filteredFiles.length > 0 && (
        <div className="px-4 pt-2 pb-1 border-b border-border">
          <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-4">{t('fileExplorer.column.name')}</div>
            <div className="col-span-2">{t('fileExplorer.column.size')}</div>
            <div className="col-span-3">{t('fileExplorer.column.modified')}</div>
            <div className="col-span-2">{t('fileExplorer.column.permissions')}</div>
            <div className="col-span-1"></div>
          </div>
        </div>
      )}

      <ScrollArea
        className={cn(
          "flex-1 p-4",
          isDragOverRoot && "bg-blue-50/50"
        )}
        onDragOver={(e) => handleDragOver(null, e)}
        onDragLeave={handleScrollAreaDragLeave}
        onDrop={(e) => handleDrop(null, e)}
      >
        {files.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">{t('fileExplorer.empty.title')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('fileExplorer.empty.description')}
            </p>
          </div>
        ) : filteredFiles.length === 0 && searchQuery ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">{t('fileExplorer.noMatches.title')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('fileExplorer.noMatches.description')}
            </p>
          </div>
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
            onToggleDirectory={toggleDirectory}
            onSelectFile={handleSelectFile}
            onSelectFolder={handleFolderSelect}
            onRenameStart={handleRenameStart}
            onRenameChange={setEditingName}
            onRenameConfirm={handleRenameComplete}
            onRenameCancel={handleRenameCancel}
            onDelete={handleDeleteFile}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        )}
      </ScrollArea>

      {/* Code Editor Modal */}
      {selectedFile && (
        <CodeEditor
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          projectPath={selectedFile.projectPath}
        />
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewer
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

export default FileTree;
