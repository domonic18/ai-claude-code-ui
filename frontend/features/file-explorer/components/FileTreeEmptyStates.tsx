/**
 * FileTreeEmptyStates.tsx
 *
 * Empty state components for the FileTree
 *
 * @module features/file-explorer/components/FileTreeEmptyStates
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, Search } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * Empty state component
 */
function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <h4 className="font-medium text-foreground mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

interface FileTreeEmptyStatesProps {
  filesLength: number;
  filteredFilesLength: number;
  searchQuery: string;
}

// 由父组件调用，React 组件或常量：FileTreeEmptyStates
/**
 * File tree empty states
 * Shows appropriate empty state based on file list status
 */
export function FileTreeEmptyStates({
  filesLength,
  filteredFilesLength,
  searchQuery
}: FileTreeEmptyStatesProps) {
  const { t } = useTranslation();

  // No files at all
  if (filesLength === 0) {
    return (
      <EmptyState
        title={t('fileExplorer.empty.title')}
        description={t('fileExplorer.empty.description')}
        icon={<Folder className="w-6 h-6 text-muted-foreground" />}
      />
    );
  }

  // No search results
  if (filteredFilesLength === 0 && searchQuery) {
    return (
      <EmptyState
        title={t('fileExplorer.noMatches.title')}
        description={t('fileExplorer.noMatches.description')}
        icon={<Search className="w-6 h-6 text-muted-foreground" />}
      />
    );
  }

  return null;
}
