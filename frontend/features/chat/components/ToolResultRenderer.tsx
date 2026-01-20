/**
 * ToolResultRenderer Component
 *
 * Renders tool execution results with appropriate styling.
 */

import React from 'react';
import { getToolResultData } from './toolUtils';
import { CollapsiblePanel } from './CollapsiblePanel';
import MarkdownRenderer from './MarkdownRenderer';

export interface ToolResultRendererProps {
  toolResult: any;
  toolId?: string;
  toolName?: string;
}

/**
 * ToolResultRenderer Component
 *
 * Displays tool results with styled containers and error handling.
 */
export function ToolResultRenderer({ toolResult, toolId, toolName }: ToolResultRendererProps) {
  const { content, isError } = getToolResultData(toolResult);
  if (!content) return null;

  // Check if this is a bash/command output that should use terminal styling
  const isTerminalOutput = toolName === 'Bash' || toolName === 'Shell';

  return (
    <CollapsiblePanel
      id={`tool-result-${toolId}`}
      defaultOpen={true}
      title={
        <span className={`text-sm font-semibold ${
          isError ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'
        }`}>
          {isError ? 'Tool Error' : 'Tool Result'}
        </span>
      }
      className={`relative mt-4 ${
        isError
          ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border border-red-200/60 dark:border-red-800/60'
          : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200/60 dark:border-green-800/60'
      } rounded-lg`}
    >
      <div
        className={`relative p-4 rounded-lg backdrop-blur-sm scroll-mt-4 ${
          isError
            ? 'bg-gradient-to-br from-red-500/5 to-rose-500/5 dark:from-red-400/5 dark:to-rose-400/5'
            : 'bg-gradient-to-br from-green-500/5 to-emerald-500/5 dark:from-green-400/5 dark:to-emerald-400/5'
        }`}
      >
        {/* Icon indicator */}
        <div className="relative flex items-center gap-2.5 mb-3">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-md ${
            isError
              ? 'bg-gradient-to-br from-red-500 to-rose-600 dark:from-red-400 dark:to-rose-500 shadow-red-500/20'
              : 'bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-400 dark:to-emerald-500 shadow-green-500/20'
          }`}>
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isError ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              )}
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className={`relative text-sm ${
          isError ? 'text-red-900 dark:text-red-100' : 'text-green-900 dark:text-green-100'
        }`}>
          <MarkdownRenderer
            content={content}
            className="prose prose-sm max-w-none dark:prose-invert"
            isTerminalOutput={isTerminalOutput}
          />
        </div>
      </div>
    </CollapsiblePanel>
  );
}

export default ToolResultRenderer;
