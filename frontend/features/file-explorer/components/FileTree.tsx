import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/shared/components/ui/ScrollArea';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Folder, FolderOpen, File, FileText, FileCode, List, TableProperties, Eye, Search, X, Trash2, Edit2, Check, XCircle, Plus, FolderPlus, FilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeEditor } from '@/features/editor';
import ImageViewer from '@/shared/components/common/ImageViewer';
import { api } from '@/shared/services';
import { SYSTEM_FOLDERS } from '../constants/fileExplorer.constants';
import type {
  FileTreeComponentProps,
  FileNode,
  FileViewMode,
  SelectedFile,
  SelectedImage,
  FileType
} from '../types/file-explorer.types';

/**
 * Default content for newly created files
 * Single newline ensures file isn't empty but appears blank when opened
 */
const DEFAULT_FILE_CONTENT = '\n';

/**
 * Invalid characters for file/folder names
 */
const INVALID_NAME_CHARS = /[\\/:*?"<>|]/;

/**
 * Validates if a file/folder name is valid
 * @param {string} name - The name to validate
 * @returns {boolean} true if valid, false otherwise
 */
function isValidFileName(name: string): boolean {
  if (!name || name.trim() === '') return false;
  if (INVALID_NAME_CHARS.test(name)) return false;
  if (name === '.' || name === '..') return false;
  return true;
}

/**
 * Extracts relative path from a full container path
 * @param {string} fullPath - Full container path (e.g., /workspace/my-workspace/test)
 * @param {string} projectName - Project name
 * @returns {string} Relative path (e.g., test)
 */
function extractRelativePath(fullPath: string, projectName: string): string {
  if (!fullPath.startsWith('/workspace/')) {
    return fullPath;
  }

  const parts = fullPath.split('/');
  const projectIndex = parts.findIndex(p => p === projectName);

  if (projectIndex === -1) {
    // Project not found in path, return as is
    return fullPath.replace('/workspace/', '');
  }

  if (projectIndex === parts.length - 1) {
    // Path is the project root
    return '.';
  }

  // Extract path after project name
  return parts.slice(projectIndex + 1).join('/');
}

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
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FileNode | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newItemType, setNewItemType] = useState<'folder' | 'file' | null>(null);
  const [newItemName, setNewItemName] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  // Drag and drop states
  const [draggingItem, setDraggingItem] = useState<FileNode | null>(null);
  const [dragOverItem, setDragOverItem] = useState<FileNode | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  /**
   * Recursively find a file node by path
   */
  const findFileByPath = (items: FileNode[], targetPath: string): FileNode | null => {
    for (const item of items) {
      if (item.path === targetPath) {
        return item;
      }
      if (item.children && item.children.length > 0) {
        const found = findFileByPath(item.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  };

  /**
   * Check if a file/folder is a system folder
   * Note: Currently no system folders are defined, all folders can be modified
   */
  const isSystemFolder = (item: FileNode): boolean => {
    if (item.type !== 'directory') return false;
    return SYSTEM_FOLDERS.length > 0 && SYSTEM_FOLDERS.includes(item.name);
  };

  /**
   * Handle file/folder deletion with confirmation
   */
  const handleDeleteFile = async (item: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();

    const isDirectory = item.type === 'directory';
    const message = isDirectory
      ? t('fileExplorer.delete.confirmDirectory', { name: item.name })
      : t('fileExplorer.delete.confirmFile', { name: item.name });

    if (!confirm(message)) {
      return;
    }

    setDeletingFile(item.path);

    try {
      const response = await api.deleteFile(selectedProject.name, item.path);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Deletion failed');
      }

      // Refresh file list after successful deletion
      await fetchFiles();
    } catch (error) {
      alert(t('fileExplorer.delete.error', { message: error.message }));
    } finally {
      setDeletingFile(null);
    }
  };

  /**
   * Start renaming a file/folder
   */
  const handleRenameStart = (item: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingFile(item.path);
    setEditingName(item.name);
  };

  /**
   * Cancel renaming
   */
  const handleRenameCancel = () => {
    setRenamingFile(null);
    setEditingName('');
  };

  /**
   * Complete renaming with confirmation
   */
  const handleRenameComplete = async () => {
    // Prevent duplicate calls
    if (!renamingFile || isRenaming) {
      return;
    }

    const trimmedName = editingName.trim();
    if (!trimmedName) {
      alert(t('fileExplorer.rename.nameCannotBeEmpty'));
      return;
    }

    // Find and store the item info before starting (search recursively in the tree)
    const item = findFileByPath(filteredFiles.length > 0 ? filteredFiles : files, renamingFile);
    if (!item) {
      setRenamingFile(null);
      setEditingName('');
      return;
    }

    const isDirectory = item.type === 'directory';
    const message = isDirectory
      ? t('fileExplorer.rename.confirmDirectory', { oldName: item.name, newName: trimmedName })
      : t('fileExplorer.rename.confirmFile', { oldName: item.name, newName: trimmedName });

    if (!confirm(message)) {
      return;
    }

    // Set renaming flag to prevent duplicate calls
    setIsRenaming(true);

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
    });

    try {
      // Race between API call and timeout
      const response = await Promise.race([
        api.renameFile(selectedProject.name, item.path, trimmedName),
        timeoutPromise
      ]) as Response;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Rename failed');
      }

      // Clear renaming state BEFORE fetching files
      setRenamingFile(null);
      setEditingName('');

      // Refresh file list after successful rename
      await fetchFiles();
    } catch (error) {
      console.error('[FileExplorer] Rename error:', error);
      alert(t('fileExplorer.rename.error', { message: error.message }));
      // Reset state on error
      setRenamingFile(null);
      setEditingName('');
    } finally {
      setIsRenaming(false);
    }
  };

  /**
   * Handle key press in rename input
   */
  const handleRenameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameComplete();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleRenameCancel();
    }
  };

  /**
   * Handle folder selection
   */
  const handleFolderSelect = (item: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'directory') {
      if (selectedFolder?.path === item.path) {
        setSelectedFolder(null);
      } else {
        setSelectedFolder(item);
        // Auto-expand the selected folder
        if (!expandedDirs.has(item.path)) {
          setExpandedDirs(prev => new Set(prev.add(item.path)));
        }
      }
    }
  };

  /**
   * Start creating new folder or file
   */
  const handleNewItemClick = (type: 'folder' | 'file') => {
    setNewItemType(type);
    setNewItemName('');
    setShowNewMenu(false);
  };

  /**
   * Cancel new item creation
   */
  const handleNewItemCancel = () => {
    setNewItemType(null);
    setNewItemName('');
  };

  /**
   * Complete new item creation
   */
  const handleNewItemComplete = async () => {
    if (isCreating) return;

    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      alert(t('fileExplorer.new.nameRequired'));
      return;
    }

    if (!isValidFileName(trimmedName)) {
      alert(t('fileExplorer.new.error', { message: 'Invalid file name. Characters \\ / : * ? " < > | are not allowed, and name cannot be . or ..' }));
      return;
    }

    setIsCreating(true);

    const basePath = selectedFolder
      ? extractRelativePath(selectedFolder.path, selectedProject.name)
      : '.';
    const fullPath = basePath === '.' ? trimmedName : `${basePath}/${trimmedName}`;
    const parentDirPath = selectedFolder?.path || null;

    try {
      if (newItemType === 'folder') {
        const response = await api.createDirectory(selectedProject.name, fullPath);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to create folder');
        }
      } else {
        const response = await api.saveFile(selectedProject.name, fullPath, DEFAULT_FILE_CONTENT);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to create file');
        }
      }

      // Expand parent directory before clearing state
      if (parentDirPath && !expandedDirs.has(parentDirPath)) {
        setExpandedDirs(prev => new Set(prev.add(parentDirPath)));
      }

      // Clear UI state
      setNewItemType(null);
      setNewItemName('');
      setSelectedFolder(null);

      // Force refresh with timestamp to ensure re-render
      await fetchFiles();
    } catch (error) {
      console.error('[FileExplorer] New item error:', error);
      alert(t('fileExplorer.new.error', { message: error.message }));
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle key press in new item input
   */
  const handleNewItemKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNewItemComplete();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleNewItemCancel();
    }
  };

  /**
   * Check if source can be dropped into target
   */
  const canDrop = (source: FileNode, target: FileNode | null): boolean => {
    // Target is null means root directory, always allow
    if (!target) return true;

    // Cannot drop into non-directory
    if (target.type !== 'directory') return false;

    // Cannot drop into itself
    if (source.path === target.path) return false;

    // Cannot drop into system folder
    if (isSystemFolder(target)) return false;

    // Cannot drop into its own subfolder
    if (target.path.startsWith(source.path + '/')) return false;

    return true;
  };

  /**
   * Handle drag start
   */
  const handleDragStart = (item: FileNode, e: React.DragEvent) => {
    // Don't drag if renaming or system folder
    if (renamingFile === item.path || isSystemFolder(item)) {
      e.preventDefault();
      return;
    }

    setDraggingItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Set custom drag image or data if needed
    e.dataTransfer.setData('text/plain', item.path);
  };

  /**
   * Handle drag over
   */
  const handleDragOver = (item: FileNode | null, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggingItem) return;

    if (item === null) {
      // Dragging over root area
      setIsDragOverRoot(true);
      setDragOverItem(null);
    } else {
      // Always highlight when dragging over a directory
      // Only allow drop if canDrop returns true
      setDragOverItem(item);
      setIsDragOverRoot(false);
    }
  };

  /**
   * Handle drag leave for the scroll area - clear all drag states when leaving the file tree
   */
  const handleScrollAreaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Check if we're actually leaving the scroll area
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOverRoot(false);
      setDragOverItem(null);
    }
  };

  /**
   * Handle drop
   */
  const handleDrop = async (targetItem: FileNode | null, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragOverItem(null);
    setIsDragOverRoot(false);

    if (!draggingItem) return;

    // Validate drop
    if (!canDrop(draggingItem, targetItem)) {
      if (targetItem?.path === draggingItem.path) {
        alert(t('fileExplorer.move.error.cannotMoveToSelf'));
      } else if (targetItem && targetItem.path.startsWith(draggingItem.path + '/')) {
        alert(t('fileExplorer.move.error.cannotMoveToChild'));
      } else if (targetItem && isSystemFolder(targetItem)) {
        alert(t('fileExplorer.move.error.cannotMoveToSystem'));
      }
      setDraggingItem(null);
      return;
    }

    // Calculate target path
    let targetPath = '';
    if (targetItem) {
      targetPath = extractRelativePath(targetItem.path, selectedProject.name);
    }

    // Confirm move
    const confirmMessage = targetItem
      ? t('fileExplorer.move.confirm', { sourceName: draggingItem.name, targetName: targetItem.name })
      : t('fileExplorer.move.confirmToRoot', { sourceName: draggingItem.name });

    if (!confirm(confirmMessage)) {
      setDraggingItem(null);
      return;
    }

    // Execute move
    setIsMoving(true);

    try {
      const sourcePath = extractRelativePath(draggingItem.path, selectedProject.name);

      const response = await api.moveFile(selectedProject.name, sourcePath, targetPath);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.message?.includes('already exists')) {
          throw new Error(t('fileExplorer.move.error.targetExists'));
        }
        throw new Error(errorData.error || errorData.message || 'Move failed');
      }

      // Refresh file list
      await fetchFiles();
    } catch (error) {
      console.error('[FileExplorer] Move error:', error);
      alert(t('fileExplorer.move.error.generic', { message: error.message }));
    } finally {
      setIsMoving(false);
      setDraggingItem(null);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      fetchFiles();
    }
  }, [selectedProject]);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('file-tree-view-mode');
    if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
      setViewMode(savedViewMode as FileViewMode);
    }
  }, []);

  // Filter files based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const filtered = filterFiles(files, searchQuery.toLowerCase());
      setFilteredFiles(filtered);

      // Auto-expand directories that contain matches
      const expandMatches = (items) => {
        items.forEach(item => {
          if (item.type === 'directory' && item.children && item.children.length > 0) {
            setExpandedDirs(prev => new Set(prev.add(item.path)));
            expandMatches(item.children);
          }
        });
      };
      expandMatches(filtered);
    }
  }, [files, searchQuery]);

  // Close new menu when clicking outside
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

  // Recursively filter files and directories based on search query
  const filterFiles = (items, query) => {
    return items.reduce((filtered, item) => {
      const matchesName = item.name.toLowerCase().includes(query);
      let filteredChildren = [];

      if (item.type === 'directory' && item.children) {
        filteredChildren = filterFiles(item.children, query);
      }

      // Include item if:
      // 1. It matches the search query, or
      // 2. It's a directory with matching children
      if (matchesName || filteredChildren.length > 0) {
        filtered.push({
          ...item,
          children: filteredChildren
        });
      }

      return filtered;
    }, []);
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await api.getFiles(selectedProject.name);

      if (!response.ok) {
        console.error('[FileExplorer] fetchFiles failed:', response.status);
        setFiles([]);
        return;
      }

      const responseData = await response.json();
      // Handle responseFormatter wrapped format: {success: true, data: [...]}
      const data = responseData.data ?? responseData;
      const filesArray = Array.isArray(data) ? data : [];
      setFiles(filesArray);
    } catch (error) {
      console.error('[FileExplorer] fetchFiles error:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  // Change view mode and save preference
  const changeViewMode = (mode: FileViewMode) => {
    setViewMode(mode);
    localStorage.setItem('file-tree-view-mode', mode);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return `0 ${t('fileExplorer.size.b')}`;
    const k = 1024;
    const sizes = [
      t('fileExplorer.size.b'),
      t('fileExplorer.size.kb'),
      t('fileExplorer.size.mb'),
      t('fileExplorer.size.gb')
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date as relative time
  const formatRelativeTime = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return t('fileExplorer.time.justNow');
    if (diffInSeconds < 3600) return t('fileExplorer.time.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('fileExplorer.time.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    if (diffInSeconds < 2592000) return t('fileExplorer.time.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
    return past.toLocaleDateString();
  };

  const renderFileTree = (items: FileNode[], level = 0) => {
    return items.map((item) => (
      <div
        key={item.path}
        className={cn(
          "select-none group rounded-md",
          dragOverItem?.path === item.path && item.type === 'directory' && "ring-2 ring-blue-400 bg-blue-50/50"
        )}
      >
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start p-2 h-auto font-normal text-left hover:bg-accent",
            selectedFolder?.path === item.path && "bg-accent/50",
            draggingItem?.path === item.path && "opacity-50"
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          draggable={!isSystemFolder(item) && renamingFile !== item.path}
          onDragStart={(e) => handleDragStart(item, e)}
          onDragOver={(e) => {
            e.stopPropagation();
            handleDragOver(item, e);
          }}
          onDrop={(e) => handleDrop(item, e)}
          onClick={(e) => {
            // Don't toggle if renaming
            if (renamingFile === item.path) return;

            // Check for Ctrl/Cmd + Click for folder selection
            if ((e.ctrlKey || e.metaKey) && item.type === 'directory') {
              handleFolderSelect(item, e);
              return;
            }

            if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else if (isImageFile(item.name)) {
              // Open image in viewer
              setSelectedImage({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
            } else {
              // Open file in editor
              setSelectedFile({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
            }
          }}
        >
          <div className="flex items-center justify-between gap-2 min-w-0 w-full">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {item.type === 'directory' ? (
                expandedDirs.has(item.path) ? (
                  <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )
              ) : (
                getFileIcon(item.name)
              )}
              {renamingFile === item.path ? (
                <Input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleRenameKeyPress}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 px-1 py-0 text-sm w-40"
                  autoFocus
                />
              ) : (
                <span className="text-sm truncate text-foreground">
                  {item.name}
                </span>
              )}
            </div>
            {!isSystemFolder(item) && renamingFile !== item.path && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
                  onClick={(e) => handleRenameStart(item, e)}
                  title={t('fileExplorer.rename.title')}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => handleDeleteFile(item, e)}
                  disabled={deletingFile === item.path}
                  title={t('fileExplorer.delete.title')}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
            {renamingFile === item.path && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-green-600 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); handleRenameComplete(); }}
                  disabled={isRenaming}
                  title={t('fileExplorer.rename.confirm')}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-600 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); handleRenameCancel(); }}
                  disabled={isRenaming}
                  title={t('fileExplorer.rename.cancel')}
                >
                  <XCircle className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </Button>

        {item.type === 'directory' &&
         expandedDirs.has(item.path) &&
         item.children &&
         item.children.length > 0 && (
          <div>
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    return imageExtensions.includes(ext);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
    const docExtensions = ['md', 'txt', 'doc', 'pdf'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    
    if (codeExtensions.includes(ext)) {
      return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
    } else if (docExtensions.includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    } else if (imageExtensions.includes(ext)) {
      return <File className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    } else {
      return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  // Render detailed view with table-like layout
  const renderDetailedView = (items, level = 0) => {
    return items.map((item) => (
      <div
        key={item.path}
        className={cn(
          "select-none group rounded-md",
          dragOverItem?.path === item.path && item.type === 'directory' && "ring-2 ring-blue-400 bg-blue-50/50"
        )}
      >
        <div
          className={cn(
            "grid grid-cols-12 gap-2 p-2 hover:bg-accent cursor-pointer items-center",
            selectedFolder?.path === item.path && "bg-accent/50",
            draggingItem?.path === item.path && "opacity-50"
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          draggable={!isSystemFolder(item) && renamingFile !== item.path}
          onDragStart={(e) => handleDragStart(item, e)}
          onDragOver={(e) => {
            e.stopPropagation();
            handleDragOver(item, e);
          }}
          onDrop={(e) => handleDrop(item, e)}
          onClick={(e) => {
            // Don't toggle if renaming
            if (renamingFile === item.path) return;

            // Check for Ctrl/Cmd + Click for folder selection
            if ((e.ctrlKey || e.metaKey) && item.type === 'directory') {
              handleFolderSelect(item, e);
              return;
            }

            if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else if (isImageFile(item.name)) {
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
          }}
        >
          <div className="col-span-4 flex items-center gap-2 min-w-0">
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            {renamingFile === item.path ? (
              <Input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleRenameKeyPress}
                onClick={(e) => e.stopPropagation()}
                className="h-6 px-1 py-0 text-sm w-32"
                autoFocus
              />
            ) : (
              <span className="text-sm truncate text-foreground">
                {item.name}
              </span>
            )}
          </div>
          <div className="col-span-2 text-sm text-muted-foreground">
            {item.type === 'file' ? formatFileSize(item.size) : '-'}
          </div>
          <div className="col-span-3 text-sm text-muted-foreground">
            {formatRelativeTime(item.modified)}
          </div>
          <div className="col-span-2 text-sm text-muted-foreground font-mono">
            {item.permissionsRwx || '-'}
          </div>
          <div className="col-span-1 flex justify-end gap-1">
            {!isSystemFolder(item) && renamingFile !== item.path && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
                  onClick={(e) => handleRenameStart(item, e)}
                  title={t('fileExplorer.rename.title')}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => handleDeleteFile(item, e)}
                  disabled={deletingFile === item.path}
                  title={t('fileExplorer.delete.title')}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
            {renamingFile === item.path && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-green-600 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); handleRenameComplete(); }}
                  disabled={isRenaming}
                  title={t('fileExplorer.rename.confirm')}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-600 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); handleRenameCancel(); }}
                  disabled={isRenaming}
                  title={t('fileExplorer.rename.cancel')}
                >
                  <XCircle className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {item.type === 'directory' &&
         expandedDirs.has(item.path) &&
         item.children &&
         renderDetailedView(item.children, level + 1)}
      </div>
    ));
  };

  // Render compact view with inline details
  const renderCompactView = (items, level = 0) => {
    return items.map((item) => (
      <div
        key={item.path}
        className={cn(
          "select-none group rounded-md",
          dragOverItem?.path === item.path && item.type === 'directory' && "ring-2 ring-blue-400 bg-blue-50/50"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between p-2 hover:bg-accent cursor-pointer",
            selectedFolder?.path === item.path && "bg-accent/50",
            draggingItem?.path === item.path && "opacity-50"
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          draggable={!isSystemFolder(item) && renamingFile !== item.path}
          onDragStart={(e) => handleDragStart(item, e)}
          onDragOver={(e) => {
            e.stopPropagation();
            handleDragOver(item, e);
          }}
          onDrop={(e) => handleDrop(item, e)}
          onClick={(e) => {
            // Don't toggle if renaming
            if (renamingFile === item.path) return;

            // Check for Ctrl/Cmd + Click for folder selection
            if ((e.ctrlKey || e.metaKey) && item.type === 'directory') {
              handleFolderSelect(item, e);
              return;
            }

            if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else if (isImageFile(item.name)) {
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
          }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            {renamingFile === item.path ? (
              <Input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleRenameKeyPress}
                onClick={(e) => e.stopPropagation()}
                className="h-6 px-1 py-0 text-sm w-32"
                autoFocus
              />
            ) : (
              <span className="text-sm truncate text-foreground">
                {item.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.type === 'file' && (
              <>
                <span>{formatFileSize(item.size)}</span>
                <span className="font-mono">{item.permissionsRwx}</span>
              </>
            )}
            {!isSystemFolder(item) && renamingFile !== item.path && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
                  onClick={(e) => handleRenameStart(item, e)}
                  title={t('fileExplorer.rename.title')}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => handleDeleteFile(item, e)}
                  disabled={deletingFile === item.path}
                  title={t('fileExplorer.delete.title')}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
            {renamingFile === item.path && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-green-600 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); handleRenameComplete(); }}
                  disabled={isRenaming}
                  title={t('fileExplorer.rename.confirm')}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-600 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); handleRenameCancel(); }}
                  disabled={isRenaming}
                  title={t('fileExplorer.rename.cancel')}
                >
                  <XCircle className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {item.type === 'directory' &&
         expandedDirs.has(item.path) &&
         item.children &&
         renderCompactView(item.children, level + 1)}
      </div>
    ));
  };

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
    <div className="h-full flex flex-col bg-card">
      {/* Header with Search and View Mode Toggle */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">{t('fileExplorer.title')}</h3>
          <div className="flex gap-1">
            {/* New button with dropdown */}
            <div className="relative new-menu-container">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1"
                onClick={() => setShowNewMenu(!showNewMenu)}
                title={t('fileExplorer.new.title')}
                data-new-menu-trigger="true"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs">{t('fileExplorer.new.title')}</span>
              </Button>
              {showNewMenu && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-popover border border-border rounded-md shadow-lg min-w-[140px]">
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                    onClick={() => handleNewItemClick('folder')}
                  >
                    <FolderPlus className="w-4 h-4" />
                    {t('fileExplorer.new.folder')}
                  </button>
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                    onClick={() => handleNewItemClick('file')}
                  >
                    <FilePlus className="w-4 h-4" />
                    {t('fileExplorer.new.file')}
                  </button>
                </div>
              )}
            </div>
            <Button
              variant={viewMode === 'simple' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => changeViewMode('simple')}
              title={t('fileExplorer.simpleView')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => changeViewMode('compact')}
              title={t('fileExplorer.compactView')}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'detailed' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => changeViewMode('detailed')}
              title={t('fileExplorer.detailedView')}
            >
              <TableProperties className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('fileExplorer.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent"
              onClick={() => setSearchQuery('')}
              title={t('fileExplorer.clearSearch')}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* New folder/file input */}
        {newItemType && (
          <div
            className="flex items-center gap-2 p-2 bg-accent rounded-md"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {newItemType === 'folder' ? (
              <FolderPlus className="w-4 h-4 text-blue-500 flex-shrink-0" />
            ) : (
              <FilePlus className="w-4 h-4 text-green-500 flex-shrink-0" />
            )}
            <input
              type="text"
              placeholder={
                newItemType === 'folder'
                  ? t('fileExplorer.new.folderPlaceholder')
                  : t('fileExplorer.new.filePlaceholder')
              }
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={handleNewItemKeyPress}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="h-7 px-2 text-sm flex-1 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            <div className="text-xs text-muted-foreground flex-shrink-0 min-w-0 max-w-32 truncate" onClick={(e) => e.stopPropagation()}>
              {selectedFolder
                ? (newItemType === 'folder'
                    ? t('fileExplorer.new.folderHint', { location: selectedFolder.name })
                    : t('fileExplorer.new.fileHint', { location: selectedFolder.name }))
                : (newItemType === 'folder'
                    ? t('fileExplorer.new.folderHint', { location: t('fileExplorer.new.root') })
                    : t('fileExplorer.new.fileHint', { location: t('fileExplorer.new.root') }))
              }
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onMouseDown={(e) => { e.stopPropagation(); handleNewItemComplete(); }}
                disabled={isCreating}
                title={t('fileExplorer.rename.confirm')}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="h-8 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onMouseDown={(e) => { e.stopPropagation(); handleNewItemCancel(); }}
                disabled={isCreating}
                title={t('fileExplorer.rename.cancel')}
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

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
          <div className={viewMode === 'detailed' ? '' : 'space-y-1'}>
            {viewMode === 'simple' && renderFileTree(filteredFiles)}
            {viewMode === 'compact' && renderCompactView(filteredFiles)}
            {viewMode === 'detailed' && renderDetailedView(filteredFiles)}
          </div>
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