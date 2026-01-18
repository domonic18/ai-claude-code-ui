/**
 * DiffViewer Component
 *
 * Displays code differences with syntax highlighting.
 */

import React from 'react';
import { calculateDiff, type DiffLine } from '../utils/diffUtils';

export interface DiffViewerProps {
  /** Old content */
  oldContent: string;
  /** New content */
  newContent: string;
  /** File path for display */
  filePath?: string;
  /** Callback when file is clicked */
  onFileOpen?: (filePath: string, diffData?: { old_string: string; new_string: string }) => void;
  /** Panel title */
  title?: string;
  /** Panel subtitle */
  subtitle?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * DiffViewer Component
 *
 * Shows a side-by-side or unified diff view with color coding.
 */
export function DiffViewer({
  oldContent,
  newContent,
  filePath,
  onFileOpen,
  title,
  subtitle,
  className = '',
}: DiffViewerProps) {
  const diffs = calculateDiff(oldContent, newContent);
  const filename = filePath ? filePath.split('/').pop() : '';

  return (
    <div className={`bg-white dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-700/60 rounded-lg overflow-hidden shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/80 dark:to-gray-800/40 border-b border-gray-200/60 dark:border-gray-700/60 backdrop-blur-sm">
        {(title || filePath) && (
          <button
            onClick={() => onFileOpen?.(filePath || '', { old_string: oldContent, new_string: newContent })}
            className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate cursor-pointer font-medium transition-colors"
          >
            {filePath || filename}
          </button>
        )}
        {subtitle && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            subtitle === 'New File'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
          }`}>
            {subtitle}
          </span>
        )}
      </div>

      {/* Diff content */}
      <div className="text-xs font-mono">
        {diffs.map((diffLine: DiffLine, i: number) => (
          <div key={i} className="flex">
            {/* Line indicator */}
            <span className={`w-8 text-center border-r flex-shrink-0 ${
              diffLine.type === 'removed'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
            }`}>
              {diffLine.type === 'removed' ? '-' : '+'}
            </span>

            {/* Line content */}
            <span className={`px-2 py-0.5 flex-1 whitespace-pre-wrap ${
              diffLine.type === 'removed'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
            }`}>
              {diffLine.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DiffViewer;
