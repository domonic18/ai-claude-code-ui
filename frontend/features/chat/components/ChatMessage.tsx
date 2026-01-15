/**
 * ChatMessage Component
 *
 * Renders a single chat message with support for:
 * - User, assistant, tool, and error messages
 * - Message grouping
 * - Tool use display
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

/**
 * Get provider from localStorage
 */
function getProvider(): string {
  if (typeof window === 'undefined') return 'claude';
  return localStorage.getItem('selected-provider') || 'claude';
}

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
            // Find all details elements and open them
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
          {message.isToolUse && message.toolName && !['Read', 'TodoWrite', 'TodoRead'].includes(message.toolName) ? (
            renderToolMessage(message, createDiff, onFileOpen, onShowSettings, selectedProject, autoExpandTools)
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

/**
 * Render tool use message
 */
function renderToolMessage(
  message: ChatMessageType,
  createDiff?: (oldStr: string, newStr: string) => any[],
  onFileOpen?: (filePath: string, diffData?: any) => void,
  onShowSettings?: () => void,
  selectedProject?: string,
  autoExpandTools?: boolean
) {
  const isMinimized = MINIMIZED_TOOLS.includes(message.toolName || '');

  if (isMinimized) {
    return renderMinimizedTool(message);
  }

  return renderFullToolMessage(message, createDiff, onFileOpen, onShowSettings, selectedProject, autoExpandTools);
}

/**
 * Render minimized tool (Grep, Glob)
 */
function renderMinimizedTool(message: ChatMessageType) {
  const input = message.toolInput ? JSON.parse(message.toolInput) : null;

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

/**
 * Render full tool message
 */
function renderFullToolMessage(
  message: ChatMessageType,
  createDiff?: (oldStr: string, newStr: string) => any[],
  onFileOpen?: (filePath: string, diffData?: any) => void,
  onShowSettings?: () => void,
  selectedProject?: string,
  autoExpandTools?: boolean
) {
  return (
    <div className="group relative bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100/30 dark:border-blue-800/30 rounded-lg p-3 mb-2">
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
              {message.toolName}
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
      {message.toolInput && (
        <details className="relative mt-3 group/details" open={autoExpandTools}>
          <summary className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50">
            <svg className="w-4 h-4 transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>Tool Input</span>
          </summary>
          <pre className="mt-2 text-xs bg-white dark:bg-gray-900 p-3 rounded overflow-x-auto">
            <code>{message.toolInput}</code>
          </pre>
        </details>
      )}

      {message.toolResult && (
        <details className="relative mt-3 group/details" open={autoExpandTools}>
          <summary className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50">
            <svg className="w-4 h-4 transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>Tool Result</span>
          </summary>
          <MarkdownRenderer
            content={message.toolResult}
            className="mt-2 text-sm prose prose-sm max-h-96 overflow-y-auto"
          />
        </details>
      )}
    </div>
  );
}

export default ChatMessage;
