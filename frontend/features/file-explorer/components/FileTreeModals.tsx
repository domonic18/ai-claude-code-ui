/**
 * FileTreeModals.tsx
 *
 * Modal components for file/image viewing in FileTree
 *
 * @module features/file-explorer/components/FileTreeModals
 */

import React from 'react';
import { CodeEditor } from '@/features/editor';
import ImageViewer from '@/shared/components/common/ImageViewer';
import type { SelectedFile, SelectedImage } from '../types/file-explorer.types';

interface FileTreeModalsProps {
  selectedFile: SelectedFile | null;
  selectedImage: SelectedImage | null;
  onCloseFile: () => void;
  onCloseImage: () => void;
}

// 由父组件调用，React 组件或常量：FileTreeModals
/**
 * File tree modals
 * Renders code editor and image viewer modals
 */
export function FileTreeModals({
  selectedFile,
  selectedImage,
  onCloseFile,
  onCloseImage
}: FileTreeModalsProps) {
  return (
    <>
      {/* Code Editor Modal */}
      {selectedFile && (
        <CodeEditor
          file={selectedFile}
          onClose={onCloseFile}
          projectPath={selectedFile.projectPath}
        />
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewer
          file={selectedImage}
          onClose={onCloseImage}
        />
      )}
    </>
  );
}
