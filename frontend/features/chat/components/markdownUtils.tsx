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
    <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground my-2">
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
      <table className="min-w-full border-collapse border border-border">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }: any) => (
    <thead className="bg-muted">{children}</thead>
  ),

  th: ({ children }: any) => (
    <th className="px-3 py-2 text-left text-sm font-semibold border border-border">
      {children}
    </th>
  ),

  td: ({ children }: any) => (
    <td className="px-3 py-2 align-top text-sm border border-border">
      {children}
    </td>
  ),
};
