/**
 * Markdown Utilities
 *
 * Utility functions for markdown rendering and content processing.
 *
 * @module features/chat/components/markdownUtils
 */

import React from 'react';

/**
 * Check if content looks multiline
 *
 * @param raw - Raw content string
 * @returns Whether content appears to be multiline
 */
export function looksMultiline(raw: string): boolean {
  return raw.includes('\n');
}

/**
 * Default markdown components (non-code)
 */
export const defaultMarkdownComponents = {
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-2">
      {children}
    </blockquote>
  ),

  a: ({ href, children }: any) => (
    <a
      href={href}
      className="text-blue-600 dark:text-blue-400 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),

  p: ({ children }: any) => <div className="mb-2 last:mb-0">{children}</div>,

  table: ({ children }: any) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }: any) => (
    <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
  ),

  th: ({ children }: any) => (
    <th className="px-3 py-2 text-left text-sm font-semibold border border-gray-200 dark:border-gray-700">
      {children}
    </th>
  ),

  td: ({ children }: any) => (
    <td className="px-3 py-2 align-top text-sm border border-gray-200 dark:border-gray-700">
      {children}
    </td>
  ),
};
