/*
 * useFileEditor.ts - Custom hook for managing file editor state
 */

import { useState, useCallback } from 'react';

interface File {
  name: string;
  path: string;
  projectName?: string;
  diffInfo?: any;
}

interface UseFileEditorReturn {
  editingFile: File | null;
  editorExpanded: boolean;
  handleFileOpen: (filePath: string, diffInfo?: any, projectName?: string) => void;
  handleCloseEditor: () => void;
  handleToggleEditorExpand: () => void;
}

/**
 * 文件编辑器状态 Hook：管理当前编辑中文件、展开/折叠等 UI 状态
 */
export function useFileEditor(): UseFileEditorReturn {
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [editorExpanded, setEditorExpanded] = useState(false);

  const handleFileOpen = useCallback((filePath: string, diffInfo: any = null, projectName?: string) => {
    const file: File = {
      name: filePath.split('/').pop() || '',
      path: filePath,
      projectName: projectName,
      diffInfo: diffInfo
    };
    setEditingFile(file);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditingFile(null);
    setEditorExpanded(false);
  }, []);

  const handleToggleEditorExpand = useCallback(() => {
    setEditorExpanded(prev => !prev);
  }, []);

  return {
    editingFile,
    editorExpanded,
    handleFileOpen,
    handleCloseEditor,
    handleToggleEditorExpand
  };
}
