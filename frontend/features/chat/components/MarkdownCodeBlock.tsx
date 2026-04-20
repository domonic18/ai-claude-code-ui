/**
 * MarkdownCodeBlock Component
 *
 * Handles code block rendering and lazy loading for markdown content.
 *
 * @module features/chat/components/MarkdownCodeBlock
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { MarkdownRendererProps } from '../types';
import { CopyButton } from './CopyButton';
import { TerminalCodeBlock } from './TerminalCodeBlock';

const LAZY_LOAD_THRESHOLD = 10 * 1024;

/**
 * LazyLoadedMarkdown Component
 *
 * For large content (>10KB), shows a preview first and loads full content on demand.
 * This prevents UI blocking from expensive KaTeX rendering.
 */
export function LazyLoadedMarkdown({
  content,
  className,
  remarkPlugins,
  rehypePlugins,
  components,
}: {
  content: string;
  className?: string;
  remarkPlugins: any[];
  rehypePlugins: any[];
  components: any;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout>();

  const preview = useMemo(() => {
    const lines = content.split('\n');
    let previewLength = 0;
    const previewLines: string[] = [];

    for (const line of lines) {
      previewLines.push(line);
      previewLength += line.length + 1;
      if (previewLength > 500) break;
    }

    return previewLines.join('\n') + '\n\n... *(内容过长，点击"查看完整内容"加载)*';
  }, [content]);

  useEffect(() => {
    if (!isExpanded) return;

    renderTimeoutRef.current = setTimeout(() => {
      setIsRendered(true);
    }, 50);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [isExpanded]);

  return (
    <div className={className}>
      {!isExpanded ? (
        <div>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={components}
          >
            {preview}
          </ReactMarkdown>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="mt-3 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            查看完整内容 ({(content.length / 1024).toFixed(1)} KB)
          </button>
        </div>
      ) : (
        <>
          {!isRendered ? (
            <div className="flex items-center gap-2 py-8 text-gray-500 dark:text-gray-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>正在渲染完整内容...</span>
            </div>
          ) : null}
          {isRendered && (
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={components}
            >
              {content}
            </ReactMarkdown>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Default markdown code component
 */
export function defaultCodeComponent({ node, inline, className, children, ...props }: any) {
  const raw = Array.isArray(children) ? children.join('') : String(children ?? '');
  const inlineDetected = inline || (node && node.type === 'inlineCode');
  const shouldInline = inlineDetected || !raw.includes('\n');

  if (shouldInline) {
    return (
      <code
        className={`font-mono text-[0.9em] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-900 border border-gray-200 dark:bg-gray-800/60 dark:text-gray-100 dark:border-gray-700 whitespace-pre-wrap break-words ${
          className || ''
        }`}
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-2">
      <CopyButton
        text={raw}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 active:opacity-100 transition-opacity text-xs px-2 py-1 rounded-md bg-gray-700/80 hover:bg-gray-700 text-white border border-gray-600"
        title="Copy code"
      />
      <pre className="bg-gray-900 dark:bg-gray-900 border border-gray-700/40 rounded-lg p-3 overflow-x-auto">
        <code className={`text-gray-100 dark:text-gray-100 text-sm font-mono ${className || ''}`} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

/**
 * Terminal-styled code component for use inside ReactMarkdown
 */
export function terminalCodeComponent({ node, inline, className, children, ...props }: any) {
  const raw = Array.isArray(children) ? children.join('') : String(children ?? '');

  if (inline || (node && node.type === 'inlineCode')) {
    return (
      <code
        className={`font-mono text-[0.9em] px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-100 border border-gray-700 whitespace-pre-wrap break-words ${
          className || ''
        }`}
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <TerminalCodeBlock content={raw} className={className}>
      {children}
    </TerminalCodeBlock>
  );
}

export { LAZY_LOAD_THRESHOLD };
