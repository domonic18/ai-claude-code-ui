/**
 * FileAttachmentsPreview Component
 *
 * Displays file attachment previews with remove functionality.
 */

import React from 'react';
import type { FileAttachment } from '../types';

export interface FileAttachmentsPreviewProps {
  files: FileAttachment[];
  onRemoveFile: (fileId: string) => void;
}

/**
 * Get file icon based on file type
 */
function getFileIcon(type: string, name: string) {
  const ext = name.toLowerCase().split('.').pop();

  // Document icons
  if (ext === 'pdf') {
    return (
      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM9.5 11A1.5 1.5 0 018 12.5v1a1.5 1.5 0 01-3 0v-1A1.5 1.5 0 019.5 11zm5 0A1.5 1.5 0 0114 12.5v1a1.5 1.5 0 01-3 0v-1A1.5 1.5 0 0114.5 11z"/>
      </svg>
    );
  }

  if (ext === 'docx' || ext === 'doc') {
    return (
      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13.5A2.5 2.5 0 0011 16v1a2.5 2.5 0 01-5 0v-1a2.5 2.5 0 002.5-2.5zm7 0A2.5 2.5 0 0115 16v1a2.5 2.5 0 01-5 0v-1a2.5 2.5 0 012.5-2.5z"/>
      </svg>
    );
  }

  if (ext === 'md' || ext === 'txt') {
    return (
      <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 6h2v1H8V6zm3 0h2v1h-2V6zm-3 3h2v1H8V9zm3 0h2v1h-2V9zm-3 3h2v1H8v-1zm3 0h2v1h-2v-1zm-3 3h2v1H8v-1zm3 0h2v1h-2v-1z"/>
      </svg>
    );
  }

  if (ext === 'json') {
    return (
      <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 8H9v-1h1v1zm1 3H9v-1h1v1zm2-3H9v-1h2v1z"/>
      </svg>
    );
  }

  if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx') {
    return (
      <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 3h18v18H3V3zm16 16H5V5h14v14zM9 8h1.5v1H9V8zm3 0h1.5v1H12V8zm-3 3h1.5v1H9v-1zm3 0h1.5v1H12v-1zm-3 3h1.5v1H9v-1zm3 0h1.5v1H12v-1z"/>
      </svg>
    );
  }

  if (ext === 'csv') {
    return (
      <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"/>
      </svg>
    );
  }

  // Default file icon
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * FileAttachmentsPreview Component
 *
 * Shows grid of attached files with upload progress and error states.
 */
export function FileAttachmentsPreview({ files, onRemoveFile }: FileAttachmentsPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      {files.map((file) => (
        <div
          key={file.id}
          className="relative group flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          style={{ minWidth: '200px', maxWidth: '300px' }}
        >
          {/* File icon */}
          {file.data ? (
            // Image preview
            <img
              src={file.data}
              alt={file.name}
              className="w-10 h-10 object-cover rounded flex-shrink-0"
            />
          ) : (
            // Document icon
            <div className="flex-shrink-0">
              {getFileIcon(file.type, file.name)}
            </div>
          )}

          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={file.name}>
              {file.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(file.size)}
            </div>
          </div>

          {/* Upload progress overlay */}
          {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-700/80 flex items-center justify-center rounded-lg">
              <div className="text-blue-600 dark:text-blue-400 text-xs font-medium">{file.uploadProgress}%</div>
            </div>
          )}

          {/* Error indicator */}
          {file.error && (
            <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center rounded-lg">
              <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          {/* Remove button */}
          <button
            onClick={() => onRemoveFile(file.id)}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
            type="button"
            title="移除文件"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default FileAttachmentsPreview;
