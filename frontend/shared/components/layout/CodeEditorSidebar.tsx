/*
 * CodeEditorSidebar.tsx - Code editor sidebar with resize functionality
 */

import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CodeEditor } from '@/features/editor';

interface File {
  name: string;
  path: string;
  projectName?: string;
  diffInfo?: any;
}

interface CodeEditorSidebarProps {
  editingFile?: File | null;
  isMobile: boolean;
  editorWidth: number;
  editorExpanded: boolean;
  projectPath?: string;
  isResizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClose: () => void;
  onToggleExpand: () => void;
}

export function CodeEditorSidebar({
  editingFile,
  isMobile,
  editorWidth,
  editorExpanded,
  projectPath,
  isResizing,
  onMouseDown,
  onClose,
  onToggleExpand
}: CodeEditorSidebarProps) {
  const { t } = useTranslation();
  const resizeRef = useRef<HTMLDivElement>(null);

  if (!editingFile) {
    return null;
  }

  // Mobile uses modal instead of sidebar
  if (isMobile) {
    return (
      <CodeEditor
        file={editingFile}
        onClose={onClose}
        projectPath={projectPath}
        isSidebar={false}
      />
    );
  }

  // Desktop sidebar
  return (
    <>
      {!editorExpanded && (
        <div
          ref={resizeRef}
          onMouseDown={onMouseDown}
          className="flex-shrink-0 w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 cursor-col-resize transition-colors relative group"
          title={t('mainContent.dragToResize')}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-blue-500 dark:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      <div
        className={`flex-shrink-0 border-l border-gray-200 dark:border-gray-700 h-full overflow-hidden ${editorExpanded ? 'flex-1' : ''}`}
        style={editorExpanded ? {} : { width: `${editorWidth}px` }}
      >
        <CodeEditor
          file={editingFile}
          onClose={onClose}
          projectPath={projectPath}
          isSidebar={true}
          isExpanded={editorExpanded}
          onToggleExpand={onToggleExpand}
        />
      </div>
    </>
  );
}
