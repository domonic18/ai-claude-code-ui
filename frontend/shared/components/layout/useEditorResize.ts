/*
 * useEditorResize.ts - Custom hook for handling editor resize functionality
 */

import { useEffect, useState } from 'react';

interface UseEditorResizeReturn {
  editorWidth: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * 编辑器宽度拖拽调整 Hook：鼠标拖拽分隔条改变编辑器宽度，带最小/最大宽度限制
 */
export function useEditorResize(isMobile: boolean): UseEditorResizeReturn {
  const [editorWidth, setEditorWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const container = document.querySelector('[data-editor-container]') as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;

      const minWidth = 300;
      const maxWidth = containerRect.width * 0.8;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setEditorWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, isMobile]);

  return {
    editorWidth,
    isResizing,
    handleMouseDown
  };
}
