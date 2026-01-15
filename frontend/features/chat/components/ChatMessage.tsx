/**
 * ChatMessage Component
 *
 * Renders a single chat message with support for:
 * - User, assistant, tool, and error messages
 * - Message grouping
 * - Tool use display with specialized rendering for each tool type
 * - Image attachments
 * - Thinking process display
 * - Markdown content
 */

import React, { useState, useEffect, useRef, memo } from 'react';
import ClaudeLogo from '../../../components/ClaudeLogo.jsx';
import CursorLogo from '../../../components/CursorLogo.jsx';
import CodexLogo from '../../../components/CodexLogo.jsx';
import MarkdownRenderer from './MarkdownRenderer';
import type { ChatMessageProps, ChatMessage as ChatMessageType } from '../types';
import { MINIMIZED_TOOLS } from '../constants';
import { formatUsageLimitText } from '../utils';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get provider from localStorage
 */
function getProvider(): string {
  if (typeof window === 'undefined') return 'claude';
  return localStorage.getItem('selected-provider') || 'claude';
}

/**
 * Parse tool input safely
 */
function parseToolInput(toolInput: string | null): any {
  if (!toolInput) return null;
  try {
    return typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput;
  } catch {
    return null;
  }
}

/**
 * Get tool result content and error status
 */
function getToolResultData(toolResult: any): { content: string; isError: boolean } {
  if (typeof toolResult === 'object' && toolResult !== null) {
    return {
      content: toolResult.content || '',
      isError: toolResult.isError || false,
    };
  }
  return {
    content: String(toolResult || ''),
    isError: false,
  };
}

// ============================================================================
// Tool Input Renderers
// ============================================================================

/**
 * Render Bash tool input as command line
 */
function renderBashInput(input: any) {
  if (!input?.command) return null;

  return (
    <div className="my-2">
      <div className="bg-gray-900 dark:bg-gray-950 rounded-md px-3 py-2 font-mono text-sm">
        <span className="text-green-400">$</span>
        <span className="text-gray-100 ml-2">{input.command}</span>
      </div>
      {input.description && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic ml-1">
          {input.description}
        </div>
      )}
    </div>
  );
}

/**
 * Render Read tool input
 */
function renderReadInput(input: any, onFileOpen?: (filePath: string) => void) {
  if (!input?.file_path) return null;

  const filename = input.file_path.split('/').pop();

  return (
    <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
      Read{' '}
      <button
        onClick={() => onFileOpen?.(input.file_path)}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono"
      >
        {filename}
      </button>
    </div>
  );
}

/**
 * Render Edit tool input with diff
 */
function renderEditInput(
  input: any,
  createDiff?: (oldStr: string, newStr: string) => any[],
  onFileOpen?: (filePath: string) => void
) {
  if (!input?.file_path || input?.old_string === undefined || input?.new_string === undefined) {
    return null;
  }

  const diffs = createDiff?.(input.old_string, input.new_string) || [];

  return (
    <details className="relative mt-3 group/details" open>
      <summary className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50">
        <svg className="w-4 h-4 transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>Editing file</span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFileOpen?.(input.file_path);
          }}
          className="ml-2 px-2 py-0.5 rounded bg-white/60 dark:bg-gray-800/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-mono text-xs"
        >
          {input.file_path.split('/').pop()}
        </button>
      </summary>
      <div className="mt-3 pl-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-700/60 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/80 dark:to-gray-800/40 border-b border-gray-200/60 dark:border-gray-700/60 backdrop-blur-sm">
            <button
              onClick={() => onFileOpen?.(input.file_path)}
              className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate cursor-pointer font-medium transition-colors"
            >
              {input.file_path}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700/50 rounded">
              Diff
            </span>
          </div>
          <div className="text-xs font-mono">
            {diffs.map((diffLine: any, i: number) => (
              <div key={i} className="flex">
                <span className={`w-8 text-center border-r ${
                  diffLine.type === 'removed'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                }`}>
                  {diffLine.type === 'removed' ? '-' : '+'}
                </span>
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
      </div>
    </details>
  );
}

/**
 * Render Write tool input
 */
function renderWriteInput(input: any, onFileOpen?: (filePath: string, diffData?: any) => void) {
  if (!input?.file_path || input?.content === undefined) return null;

  return (
    <details className="relative mt-3 group/details" open>
      <summary className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50">
        <svg className="w-4 h-4 transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="flex items-center gap-2">
          <span className="text-lg leading-none">📄</span>
          <span>Creating new file:</span>
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFileOpen?.(input.file_path, { old_string: '', new_string: input.content });
          }}
          className="ml-2 px-2.5 py-1 rounded-md bg-white/60 dark:bg-gray-800/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-mono text-xs font-medium transition-all duration-200 shadow-sm"
        >
          {input.file_path.split('/').pop()}
        </button>
      </summary>
      <div className="mt-3 pl-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-700/60 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/80 dark:to-gray-800/40 border-b border-gray-200/60 dark:border-gray-700/60 backdrop-blur-sm">
            <button
              onClick={() => onFileOpen?.(input.file_path, { old_string: '', new_string: input.content })}
              className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate cursor-pointer font-medium transition-colors"
            >
              {input.file_path}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
              New File
            </span>
          </div>
          <div className="text-xs font-mono p-4 whitespace-pre-wrap break-words max-h-96 overflow-y-auto bg-green-50/50 dark:bg-green-900/10 text-gray-800 dark:text-gray-200">
            {input.content}
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * Render default tool input
 */
function renderDefaultInput(toolInput: string) {
  return (
    <details className="relative mt-3 group/details" open>
      <summary className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50">
        <svg className="w-4 h-4 transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>Tool Input</span>
      </summary>
      <pre className="mt-2 text-xs bg-white dark:bg-gray-900 p-3 rounded overflow-x-auto">
        <code>{toolInput}</code>
      </pre>
    </details>
  );
}

// ============================================================================
// Tool Result Renderers
// ============================================================================

/**
 * Render tool result with styled container
 */
function renderStyledToolResult(
  content: string,
  isError: boolean,
  toolId?: string
) {
  return (
    <div
      id={`tool-result-${toolId}`}
      className={`relative mt-4 p-4 rounded-lg border backdrop-blur-sm scroll-mt-4 ${
        isError
          ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-200/60 dark:border-red-800/60'
          : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/60 dark:border-green-800/60'
      }`}>
      {/* Decorative gradient overlay */}
      <div className={`absolute inset-0 rounded-lg opacity-50 ${
        isError
          ? 'bg-gradient-to-br from-red-500/5 to-rose-500/5 dark:from-red-400/5 dark:to-rose-400/5'
          : 'bg-gradient-to-br from-green-500/5 to-emerald-500/5 dark:from-green-400/5 dark:to-emerald-400/5'
      }`}></div>

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
        <span className={`text-sm font-semibold ${
          isError
            ? 'text-red-800 dark:text-red-200'
            : 'text-green-800 dark:text-green-200'
        }`}>
          {isError ? 'Tool Error' : 'Tool Result'}
        </span>
      </div>

      <div className={`relative text-sm ${
        isError
          ? 'text-red-900 dark:text-red-100'
          : 'text-green-900 dark:text-green-100'
      }`}>
        <MarkdownRenderer
          content={content}
          className="prose prose-sm max-w-none dark:prose-invert"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Simplified Tool Indicators (for Read, TodoWrite, etc.)
// ============================================================================

/**
 * Render simplified Read tool indicator
 */
function renderReadIndicator(input: any, onFileOpen?: (filePath: string) => void) {
  if (!input?.file_path) return null;

  const filename = input.file_path.split('/').pop();

  return (
    <div className="bg-gray-50/50 dark:bg-gray-800/30 border-l-2 border-gray-400 dark:border-gray-500 pl-3 py-2 my-2">
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="font-medium">Read</span>
        <button
          onClick={() => onFileOpen?.(input.file_path)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-mono transition-colors"
        >
          {filename}
        </button>
      </div>
    </div>
  );
}

/**
 * Render simplified TodoWrite indicator
 */
function renderTodoIndicator(input: any) {
  if (!input?.todos || !Array.isArray(input.todos)) return null;

  return (
    <div className="bg-gray-50/50 dark:bg-gray-800/30 border-l-2 border-gray-400 dark:border-gray-500 pl-3 py-2 my-2">
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
        <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span className="font-medium">Update todo list</span>
      </div>
    </div>
  );
}

// ============================================================================
// Full Tool Message Container
// ============================================================================

interface FullToolMessageProps {
  message: ChatMessageType;
  createDiff?: (oldStr: string, newStr: string) => any[];
  onFileOpen?: (filePath: string, diffData?: any) => void;
  onShowSettings?: () => void;
  autoExpandTools?: boolean;
}

/**
 * Render full tool message with proper styling
 */
function renderFullToolMessage({
  message,
  createDiff,
  onFileOpen,
  onShowSettings,
}: FullToolMessageProps) {
  const input = parseToolInput(message.toolInput);
  const toolName = message.toolName || '';

  // Render tool input based on type
  const renderToolInput = () => {
    if (!message.toolInput) return null;

    switch (toolName) {
      case 'Bash':
        return renderBashInput(input);
      case 'Read':
        return renderReadInput(input, onFileOpen);
      case 'Edit':
        return renderEditInput(input, createDiff, onFileOpen);
      case 'Write':
        return renderWriteInput(input, onFileOpen);
      default:
        return renderDefaultInput(message.toolInput);
    }
  };

  // Determine if we should hide the tool result
  const shouldHideResult = () => {
    if (!message.toolResult) return true;

    const { isError } = getToolResultData(message.toolResult);
    const toolsWithHiddenResult = ['Edit', 'Write', 'ApplyPatch', 'Bash'];

    return !isError && toolsWithHiddenResult.includes(toolName);
  };

  // Render tool result
  const renderToolResult = () => {
    if (shouldHideResult()) return null;

    const { content, isError } = getToolResultData(message.toolResult);
    if (!content) return null;

    return renderStyledToolResult(content, isError, message.toolId);
  };

  return (
    <div className="group relative bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100/30 dark:border-blue-800/30 rounded-lg p-3 mb-2">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 to-indigo-500/3 dark:from-blue-400/3 dark:to-indigo-400/3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 dark:shadow-blue-400/20">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              {toolName}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {message.toolId}
            </span>
          </div>
        </div>
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

// ============================================================================
// Minimized Tool Message (Grep, Glob)
// ============================================================================

/**
 * Render minimized tool (Grep, Glob)
 */
function renderMinimizedTool(message: ChatMessageType) {
  const input = parseToolInput(message.toolInput);

  return (
    <div className="group relative bg-gray-50/50 dark:bg-gray-800/30 border-l-2 border-blue-400 dark:border-blue-500 pl-3 py-2 my-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 flex-1 min-w-0">
          <svg className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="font-medium flex-shrink-0">{message.toolName}</span>
          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">•</span>
          {input && (
            <span className="font-mono truncate flex-1 min-w-0">
              {input.pattern && <span>pattern: <span className="text-blue-600 dark:text-blue-400">{input.pattern}</span></span>}
              {input.path && <span className="ml-2">in: {input.path}</span>}
            </span>
          )}
        </div>
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

// ============================================================================
// Main Component
// ============================================================================

/**
 * ChatMessage Component
 *
 * Memoized component to prevent unnecessary re-renders
 */
export const ChatMessage = memo(function ChatMessage({
  message,
  index,
  prevMessage,
  createDiff,
  onFileOpen,
  onShowSettings,
  autoExpandTools = false,
  showRawParameters = false,
  showThinking = true,
  selectedProject,
}: ChatMessageProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if message should be grouped with previous
  const isGrouped = prevMessage && prevMessage.type === message.type &&
    ((prevMessage.type === 'assistant') ||
      (prevMessage.type === 'user') ||
      (prevMessage.type === 'tool') ||
      (prevMessage.type === 'error'));

  // Auto-expand tools on scroll into view
  useEffect(() => {
    if (!autoExpandTools || !messageRef.current || !message.isToolUse) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isExpanded) {
            setIsExpanded(true);
            const details = messageRef.current?.querySelectorAll('details');
            details?.forEach(detail => {
              detail.open = true;
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(messageRef.current);

    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current);
      }
    };
  }, [autoExpandTools, isExpanded, message.isToolUse]);

  /**
   * Render user message
   */
  if (message.type === 'user') {
    return (
      <div
        ref={messageRef}
        className={`chat-message user ${isGrouped ? 'grouped' : ''} flex justify-end px-3 sm:px-0`}
      >
        <div className="flex items-end space-x-0 sm:space-x-3 w-full sm:w-auto sm:max-w-[85%] md:max-w-md lg:max-w-lg xl:max-w-xl">
          <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-3 sm:px-4 py-2 shadow-sm flex-1 sm:flex-initial">
            <div className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </div>
            {message.images && message.images.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {message.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.data}
                    alt={img.name}
                    className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(img.data, '_blank')}
                  />
                ))}
              </div>
            )}
            <div className="text-xs text-blue-100 mt-1 text-right">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
          {!isGrouped && (
            <div className="hidden sm:flex w-8 h-8 bg-blue-600 rounded-full items-center justify-center text-white text-sm flex-shrink-0">
              U
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * Render assistant/error/tool message
   */
  const provider = getProvider();
  const displayName = message.type === 'error'
    ? 'Error'
    : message.type === 'tool'
    ? 'Tool'
    : provider === 'cursor'
    ? 'Cursor'
    : provider === 'codex'
    ? 'Codex'
    : 'Claude';

  return (
    <div
      ref={messageRef}
      className={`chat-message ${message.type} ${isGrouped ? 'grouped' : ''} px-3 sm:px-0`}
    >
      <div className="w-full">
        {/* Message header */}
        {!isGrouped && (
          <div className="flex items-center space-x-3 mb-2">
            {message.type === 'error' ? (
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                !
              </div>
            ) : message.type === 'tool' ? (
              <div className="w-8 h-8 bg-gray-600 dark:bg-gray-700 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                🔧
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 p-1">
                {provider === 'cursor' ? (
                  <CursorLogo className="w-full h-full" />
                ) : provider === 'codex' ? (
                  <CodexLogo className="w-full h-full" />
                ) : (
                  <ClaudeLogo className="w-full h-full" />
                )}
              </div>
            )}
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {displayName}
            </div>
          </div>
        )}

        {/* Message content */}
        <div className="w-full">
          {message.isToolUse && message.toolName ? (
            (() => {
              // Handle minimized tools (Grep, Glob)
              if (MINIMIZED_TOOLS.includes(message.toolName as any)) {
                return renderMinimizedTool(message);
              }

              // Handle simplified indicators (Read, TodoWrite)
              if (message.toolName === 'Read') {
                const input = parseToolInput(message.toolInput);
                return renderReadIndicator(input, onFileOpen);
              }

              if (message.toolName === 'TodoWrite') {
                const input = parseToolInput(message.toolInput);
                return renderTodoIndicator(input);
              }

              // Handle full tool messages
              return renderFullToolMessage({
                message,
                createDiff,
                onFileOpen,
                onShowSettings,
                autoExpandTools,
              });
            })()
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {showThinking && message.thinking && (
                <details className="mb-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <summary className="cursor-pointer font-medium text-yellow-800 dark:text-yellow-200">
                    Thinking Process
                  </summary>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <MarkdownRenderer content={message.thinking} />
                  </div>
                </details>
              )}
              <MarkdownRenderer
                content={formatUsageLimitText(message.content || '')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;
