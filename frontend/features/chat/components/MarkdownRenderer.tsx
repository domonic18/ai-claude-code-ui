/**
 * MarkdownRenderer Component
 *
 * Renders markdown content with support for:
 * - GitHub Flavored Markdown (GFM)
 * - Math formulas (KaTeX)
 * - Syntax highlighting for code blocks
 * - Copy code button
 * - Custom component overrides
 */

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { MarkdownRendererProps } from '../types';
import { decodeHtmlEntities, normalizeInlineCodeFences, unescapeWithMathProtection, looksMultiline } from '../utils';

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
            // Fallback
            copyToClipboard(textToCopy, doSet);
          });
        } else {
          copyToClipboard(textToCopy, doSet);
        }
      } catch {
        copyToClipboard(textToCopy, doSet);
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
 * Fallback copy to clipboard using textarea method
 */
function copyToClipboard(text: string, callback: () => void) {
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
}: MarkdownRendererProps) {
  // Process content
  const processedContent = useMemo(() => {
    if (!content) return '';
    const normalized = normalizeInlineCodeFences(String(content));
    return unescapeWithMathProtection(normalized);
  }, [content]);

  // Configure plugins
  const remarkPlugins = useMemo(() => {
    const plugins = [remarkGfm];
    if (enableMath) {
      plugins.push(remarkMath);
    }
    return plugins;
  }, [enableMath]);

  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [];
    if (enableMath) {
      plugins.push(rehypeKatex);
    }
    return plugins;
  }, [enableMath]);

  // Merge custom components with defaults
  const markdownComponents = useMemo(() => ({
    ...defaultMarkdownComponents,
    ...customComponents,
  }), [customComponents]);

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
