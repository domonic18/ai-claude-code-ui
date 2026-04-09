/**
 * StreamingIndicator Component
 *
 * Displays streaming status for AI responses including:
 * - Animated loading indicator
 * - Thinking process preview
 * - Token usage display
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { StreamingIndicatorProps } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

/**
 * StreamingIndicator Component
 *
 * Shows a visual indicator when AI is streaming response.
 */
export function StreamingIndicator({
  isStreaming = false,
  content = '',
  thinking,
}: StreamingIndicatorProps) {
  const { t } = useTranslation();
  if (!isStreaming && !content) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
      {/* Animated dots - only show while actively streaming */}
      {isStreaming && (
        <div className="flex gap-1 flex-shrink-0">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
        </div>
      )}

      {/* Status text */}
      <span className="text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
        {isStreaming ? t('chat.streaming.responding') : t('chat.streaming.complete')}
      </span>

      {/* Preview of streaming content */}
      {content && (
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
            {content.slice(0, 100)}
            {content.length > 100 && '...'}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ThinkingProcess Component
 *
 * Displays the AI's thinking process when available.
 */
interface ThinkingProcessProps {
  /** Thinking content */
  thinking?: string;
  /** Whether to show */
  show?: boolean;
}

export function ThinkingProcess({ thinking, show = true }: ThinkingProcessProps) {
  if (!thinking || !show) {
    return null;
  }

  return (
    <details className="mb-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
      <summary className="cursor-pointer font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Thinking Process
      </summary>
      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 max-h-96 overflow-y-auto">
        <MarkdownRenderer content={thinking} />
      </div>
    </details>
  );
}

export default StreamingIndicator;
