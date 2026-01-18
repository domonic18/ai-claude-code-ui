/**
 * AssistantMessage Component
 *
 * Renders assistant/assistant messages with thinking process and content.
 */

import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { formatUsageLimitText } from '../utils';

export interface AssistantMessageProps {
  content: string;
  showThinking?: boolean;
  thinking?: string;
}

/**
 * AssistantMessage Component
 *
 * Displays AI assistant responses with optional thinking process.
 */
export function AssistantMessage({ content, showThinking = true, thinking }: AssistantMessageProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {/* Thinking process - collapsible by default */}
      {showThinking && thinking && (
        <details className="mb-4 group/thinking border border-gray-200 dark:border-gray-700/50 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-900/30">
          <summary className="flex items-center gap-2 cursor-pointer px-4 py-2.5 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 group-open/thinking:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Thinking Process
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
              (Internal reasoning)
            </span>
          </summary>
          <div className="px-4 py-3 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/30 dark:bg-gray-800/20">
            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              <MarkdownRenderer content={thinking} />
            </div>
          </div>
        </details>
      )}

      {/* Main content */}
      <MarkdownRenderer content={formatUsageLimitText(content || '')} />
    </div>
  );
}

export default AssistantMessage;
