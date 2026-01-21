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
import { decodeHtmlEntities, normalizeInlineCodeFences, unescapeWithMathProtection, looksMultiline } from '../utils';

// 阈值：超过这个长度的内容使用懒加载（10KB）
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

  // Get preview (first 500 chars + ellipsis)
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

    // Delay rendering slightly to show loading state
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
 * TerminalOutput Component
 *
 * Specialized component for rendering bash/shell command output
 * with terminal-like styling
 */
function TerminalOutput({ content }: { content: string }) {
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-700/50 bg-gray-950 shadow-xl">
      {/* Terminal header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <span className="text-xs text-gray-400 font-medium">terminal</span>
      </div>

      {/* Terminal content */}
      <pre className="p-3 m-0 text-sm leading-relaxed overflow-x-auto">
        <code className="font-mono text-gray-100 whitespace-pre-wrap break-words">
          {content}
        </code>
      </pre>

      {/* Copy button */}
      <TerminalCopyButton content={content} />
    </div>
  );
}

/**
 * TerminalCopyButton Component
 *
 * Copy button for terminal output
 */
function TerminalCopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const doSet = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(content).then(doSet).catch(() => {
          fallbackCopy(content, doSet);
        });
      } else {
        fallbackCopy(content, doSet);
      }
    } catch {
      fallbackCopy(content, doSet);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-gray-700/80 hover:bg-gray-700 text-white border border-gray-600 flex items-center gap-1"
      title={copied ? 'Copied!' : 'Copy output'}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>Copied</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

/**
 * Fallback copy to clipboard
 */
function fallbackCopy(text: string, callback: () => void) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
  } catch {
    // Ignore errors
  }

  document.body.removeChild(textarea);
  callback();
}

/**
 * Default markdown components
 */
const defaultMarkdownComponents = {
  /**
   * Code component with copy button for blocks
   */
  code: ({ node, inline, className, children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    const raw = Array.isArray(children) ? children.join('') : String(children ?? '');
    const inlineDetected = inline || (node && node.type === 'inlineCode');
    const shouldInline = inlineDetected || !looksMultiline(raw);

    // Inline code
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

    // Code block with copy button
    const textToCopy = raw;

    const handleCopy = () => {
      const doSet = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      };

      try {
        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText(textToCopy).then(doSet).catch(() => {
            fallbackCopy(textToCopy, doSet);
          });
        } else {
          fallbackCopy(textToCopy, doSet);
        }
      } catch {
        fallbackCopy(textToCopy, doSet);
      }
    };

    return (
      <div className="relative group my-2">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 active:opacity-100 transition-opacity text-xs px-2 py-1 rounded-md bg-gray-700/80 hover:bg-gray-700 text-white border border-gray-600"
          title={copied ? 'Copied' : 'Copy code'}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Copied
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
              </svg>
              Copy
            </span>
          )}
        </button>
        <pre className="bg-gray-900 dark:bg-gray-900 border border-gray-700/40 rounded-lg p-3 overflow-x-auto">
          <code className={`text-gray-100 dark:text-gray-100 text-sm font-mono ${className || ''}`} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },

  /**
   * Blockquote component
   */
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-2">
      {children}
    </blockquote>
  ),

  /**
   * Link component (opens in new tab)
   */
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

  /**
   * Paragraph component
   */
  p: ({ children }: any) => <div className="mb-2 last:mb-0">{children}</div>,

  /**
   * Table component (GFM)
   */
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700">
        {children}
      </table>
    </div>
  ),

  /**
   * Table head component
   */
  thead: ({ children }: any) => (
    <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
  ),

  /**
   * Table header cell component
   */
  th: ({ children }: any) => (
    <th className="px-3 py-2 text-left text-sm font-semibold border border-gray-200 dark:border-gray-700">
      {children}
    </th>
  ),

  /**
   * Table data cell component
   */
  td: ({ children }: any) => (
    <td className="px-3 py-2 align-top text-sm border border-gray-200 dark:border-gray-700">
      {children}
    </td>
  ),
};

/**
 * MarkdownRenderer Component
 *
 * Renders markdown content with plugins and custom components.
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
  // Process content
  const processedContent = useMemo(() => {
    if (!content) return '';
    const normalized = normalizeInlineCodeFences(String(content));
    return unescapeWithMathProtection(normalized);
  }, [content]);

  // For terminal output, use specialized component
  if (isTerminalOutput) {
    // Check if content is wrapped in markdown code blocks
    const hasCodeBlockFence = processedContent.trim().startsWith('```');

    if (hasCodeBlockFence) {
      // Content is already in markdown format, render with ReactMarkdown
      // but with terminal-styled code blocks
      const remarkPlugins = [remarkGfm];
      const rehypePlugins = [];

      const terminalComponents = useMemo(() => ({
        ...defaultMarkdownComponents,
        code: ({ node, inline, className, children, ...props }: any) => {
          const raw = Array.isArray(children) ? children.join('') : String(children ?? '');

          // Skip inline code, only process code blocks
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

          // Code block - use terminal styling
          return (
            <div className="relative group my-2">
              <div className="rounded-lg overflow-hidden border border-gray-700/50 bg-gray-950 shadow-xl">
                {/* Terminal header bar */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">terminal</span>
                </div>

                {/* Terminal content */}
                <pre className="p-3 m-0 text-sm leading-relaxed overflow-x-auto">
                  <code className={`text-gray-100 font-mono whitespace-pre-wrap break-words ${className || ''}`} {...props}>
                    {children}
                  </code>
                </pre>
              </div>

              {/* Copy button */}
              <TerminalCopyButton content={raw} />
            </div>
          );
        },
      }), []);

      return (
        <div className={className}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={terminalComponents}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      );
    }

    // Plain text terminal output - use TerminalOutput component
    return (
      <div className={className}>
        <TerminalOutput content={processedContent} />
      </div>
    );
  }

  // Configure plugins
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
      // Configure rehype-katex with strict mode disabled to avoid warnings for Chinese text in math mode
      plugins.push([rehypeKatex, { strict: false }]);
    }
    return plugins;
  }, [enableMath]);

  // Merge custom components with defaults
  const markdownComponents = useMemo(() => ({
    ...defaultMarkdownComponents,
    ...customComponents,
  }), [customComponents]);

  // Check if content is too large for synchronous rendering
  const isLargeContent = processedContent.length > LAZY_LOAD_THRESHOLD;

  // For large content, use lazy loading to prevent UI blocking
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

export default MarkdownRenderer;
