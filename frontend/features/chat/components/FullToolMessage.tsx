/**
 * FullToolMessage Component
 *
 * Renders complete tool use messages with input/output display.
 */

import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { ToolInputRenderer } from './ToolInputRenderer';
import { ToolResultRenderer } from './ToolResultRenderer';
import { parseToolInput, shouldHideToolResult } from './toolUtils';

export interface FullToolMessageProps {
  message: ChatMessageType;
  onFileOpen?: (filePath: string, diffData?: any) => void;
  onShowSettings?: () => void;
}

/**
 * FullToolMessage Component
 *
 * Displays complete tool execution with styled container and input/output.
 */
export function FullToolMessage({ message, onFileOpen, onShowSettings }: FullToolMessageProps) {
  const toolName = message.toolName || '';
  const input = parseToolInput(message.toolInput);

  // Render tool input
  const renderToolInput = () => {
    if (!message.toolInput) return null;
    return <ToolInputRenderer toolName={toolName} toolInput={message.toolInput} onFileOpen={onFileOpen} />;
  };

  // Render tool result
  const renderToolResult = () => {
    if (!message.toolResult) return null;
    const isError = typeof message.toolResult === 'object' && message.toolResult.isError;
    if (shouldHideToolResult(toolName, !isError)) return null;

    return <ToolResultRenderer toolResult={message.toolResult} toolId={message.toolId} toolName={toolName} />;
  };

  return (
    <div className="group relative bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100/30 dark:border-blue-800/30 rounded-lg p-3 mb-2">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 to-indigo-500/3 dark:from-blue-400/3 dark:to-indigo-400/3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Tool icon */}
          <div className="relative w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 dark:shadow-blue-400/20">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          {/* Tool name and ID */}
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              {toolName}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {message.toolId}
            </span>
          </div>
        </div>

        {/* Settings button */}
        {onShowSettings && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowSettings();
            }}
            className="p-2 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 group/btn backdrop-blur-sm"
            title="Tool Settings"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover/btn:text-blue-600 dark:group-hover/btn:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Tool input/output */}
      <div className="relative">
        {renderToolInput()}
        {renderToolResult()}
      </div>
    </div>
  );
}

export default FullToolMessage;
