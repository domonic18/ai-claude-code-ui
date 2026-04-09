import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import {
  List,
  TableProperties,
  Eye,
  Plus,
  FolderPlus,
  FilePlus,
  Search,
  X
} from 'lucide-react';
import type { FileViewMode } from '../types/file-explorer.types';

interface FileTreeHeaderProps {
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

/**
 * 文件树头部组件
 * 包含视图切换、搜索和新建按钮
 */
export function FileTreeHeader({
  viewMode,
  searchQuery,
  showNewMenu,
  newItemType,
  onViewModeChange,
  onSearchChange,
  onNewItemClick,
  onToggleNewMenu,
  onCloseNewMenu
}: FileTreeHeaderProps) {
  const { t } = useTranslation();

  return (
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
              onClick={onToggleNewMenu}
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
                  onClick={() => onNewItemClick('folder')}
                >
                  <FolderPlus className="w-4 h-4" />
                  {t('fileExplorer.new.folder')}
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                  onClick={() => onNewItemClick('file')}
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
            onClick={() => onViewModeChange('simple')}
            title={t('fileExplorer.simpleView')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'compact' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onViewModeChange('compact')}
            title={t('fileExplorer.compactView')}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onViewModeChange('detailed')}
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
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 pr-8 h-8 text-sm"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent"
            onClick={() => onSearchChange('')}
            title={t('fileExplorer.clearSearch')}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default FileTreeHeader;
