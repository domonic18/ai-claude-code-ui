/**
 * MinimizedToolMessage Component
 *
 * Renders minimized indicators for frequently used tools (Grep, Glob).
 */

import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { parseToolInput } from './toolUtils';

export interface MinimizedToolMessageProps {
  message: ChatMessageType;
}

/**
 * MinimizedToolMessage Component
 *
 * Displays compact indicators for high-frequency tools like Grep and Glob.
 */
export function MinimizedToolMessage({ message }: MinimizedToolMessageProps) {
  const input = parseToolInput(message.toolInput);

  return (
    <div className="group relative bg-gray-50/50 dark:bg-gray-800/30 border-l-2 border-blue-400 dark:border-blue-500 pl-3 py-2 my-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 flex-1 min-w-0">
          {/* Search icon */}
          <svg className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          {/* Tool name */}
          <span className="font-medium flex-shrink-0">{message.toolName}</span>

          {/* Separator */}
          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">•</span>

          {/* Pattern/Path info */}
          {input && (
            <span className="font-mono truncate flex-1 min-w-0">
              {input.pattern && (
                <span>pattern: <span className="text-blue-600 dark:text-blue-400">{input.pattern}</span></span>
              )}
              {input.path && <span className="ml-2">in: {input.path}</span>}
            </span>
          )}
        </div>

        {/* Results link */}
        {message.toolResult && (
          <a
            href={`#tool-result-${message.toolId}`}
            className="flex-shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
          >
            <span>results</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

export default MinimizedToolMessage;
