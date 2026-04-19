/**
 * FileTree.tsx
 *
 * File tree component displaying project structure with file operations and multiple view modes
 *
 * @module features/file-explorer/components/FileTree
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileTreeMain } from './FileTreeMain';
import { buildHeaderProps, buildNewItemProps, buildContentProps, buildModalsProps } from './FileTreeProps';
import { useFileOperations } from '../hooks/useFileOperations';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useFileTreeState } from '../hooks/useFileTreeState';
import type { FileTreeComponentProps } from '../types/file-explorer.types';

/**
 * File tree component
 * Displays project file structure with file operations and multiple view modes
 *
 * @param {FileTreeComponentProps} props - Component props
 * @returns {JSX.Element} File tree component
 */
function FileTree({ selectedProject, className = '' }: FileTreeComponentProps) {
  const { t } = useTranslation();

  const state = useFileTreeState({ selectedProject });
  const ops = useFileOperations({
    selectedProject,
    files: state.files,
    setFiles: state.setFiles,
    expandedDirs: state.expandedDirs,
    setExpandedDirs: state.setExpandedDirs
  });
  const dnd = useDragAndDrop({
    selectedProject,
    files: state.files,
    fetchFiles: state.fetchFiles
  });

  if (state.loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          {t('fileExplorer.loading')}
        </div>
      </div>
    );
  }

  return (
    <FileTreeMain
      className={className}
      viewMode={state.viewMode}
      searchQuery={state.searchQuery}
      showNewMenu={state.showNewMenu}
      filteredFiles={state.filteredFiles}
      headerProps={buildHeaderProps(state, ops)}
      newItemProps={buildNewItemProps(state, ops)}
      contentProps={buildContentProps(state, ops, dnd, t)}
      modalsProps={buildModalsProps(state)}
    />
  );
}

export default FileTree;
