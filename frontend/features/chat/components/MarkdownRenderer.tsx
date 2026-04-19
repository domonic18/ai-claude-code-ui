/**
 * MarkdownRenderer Component
 *
 * Renders markdown content with support for:
 * - GitHub Flavored Markdown (GFM)
 * - Math formulas (KaTeX)
 * - Syntax highlighting for code blocks
 * - Copy code button
 * - Terminal output styling for bash/shell results
 * - Custom component overrides
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { MarkdownRendererProps } from '../types';
import { normalizeInlineCodeFences, unescapeWithMathProtection, looksMultiline } from '../utils';
import { CopyButton } from './CopyButton';
import { TerminalCodeBlock, TerminalOutput } from './TerminalCodeBlock';

const LAZY_LOAD_THRESHOLD = 10 * 1024;

/**
 * LazyLoadedMarkdown Component
 *
 * For large content (>10KB), shows a preview first and loads full content on demand.
 * This prevents UI blocking from expensive KaTeX rendering.
 */
function LazyLoadedMarkdown({
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
 * Default markdown components
 */
const defaultMarkdownComponents = {
  code: ({ node, inline, className, children, ...props }: any) => {
    const raw = Array.isArray(children) ? children.join('') : String(children ?? '');
    const inlineDetected = inline || (node && node.type === 'inlineCode');
    const shouldInline = inlineDetected || !looksMultiline(raw);

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
  },

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

/**
 * Terminal-styled code component for use inside ReactMarkdown
 */
function terminalCodeComponent({ node, inline, className, children, ...props }: any) {
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

/**
 * MarkdownRenderer Component
 *
 * @param props - Component props
 * @returns Rendered markdown
 */
export function MarkdownRenderer({
  content,
  className,
  enableMath = true,
  components: customComponents = {},
  isTerminalOutput = false,
}: MarkdownRendererProps) {
  const processedContent = useMemo(() => {
    if (!content) return '';
    const normalized = normalizeInlineCodeFences(String(content));
    return unescapeWithMathProtection(normalized);
  }, [content]);

  const remarkPlugins = useMemo(() => {
    const plugins: any[] = [remarkGfm];
    if (enableMath) {
      plugins.push(remarkMath);
    }
    return plugins;
  }, [enableMath]);

  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [];
    if (enableMath) {
      plugins.push([rehypeKatex, { strict: false }]);
    }
    return plugins;
  }, [enableMath]);

  const markdownComponents = useMemo(() => ({
    ...defaultMarkdownComponents,
    ...customComponents,
  }), [customComponents]);

  if (isTerminalOutput) {
    return (
      <TerminalMarkdownRenderer
        content={processedContent}
        className={className}
      />
    );
  }

  const isLargeContent = processedContent.length > LAZY_LOAD_THRESHOLD;

  if (isLargeContent && enableMath) {
    return (
      <LazyLoadedMarkdown
        content={processedContent}
        className={className}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      />
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

/**
 * TerminalMarkdownRenderer — renders terminal-styled markdown content
 */
function TerminalMarkdownRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const hasCodeBlockFence = content.trim().startsWith('```');

  const terminalComponents = useMemo(() => ({
    ...defaultMarkdownComponents,
    code: terminalCodeComponent,
  }), []);

  if (hasCodeBlockFence) {
    return (
      <div className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[]}
          components={terminalComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={className}>
      <TerminalOutput content={content} />
    </div>
  );
}

export default MarkdownRenderer;
