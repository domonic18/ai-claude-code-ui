/**
 * FileAttachmentsPreview Component
 *
 * Displays file attachment previews with remove functionality.
 */

import React from 'react';
import type { FileAttachment } from '../types';

export interface FileAttachmentsPreviewProps {
  files: FileAttachment[];
  onRemoveFile: (fileName: string) => void;
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
        <div key={file.name} className="relative group">
          {/* Image preview */}
          {file.data ? (
            <img
              src={file.data}
              alt={file.name}
              className="w-20 h-20 object-cover rounded"
            />
          ) : (
            <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}

          {/* Upload progress */}
          {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-xs">{file.uploadProgress}%</div>
            </div>
          )}

          {/* Error indicator */}
          {file.error && (
            <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          {/* Remove button */}
          <button
            onClick={() => onRemoveFile(file.name)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            type="button"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default FileAttachmentsPreview;
