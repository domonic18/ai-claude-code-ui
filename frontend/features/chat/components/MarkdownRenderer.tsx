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

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { MarkdownRendererProps } from '../types';
import { normalizeInlineCodeFences, unescapeWithMathProtection } from '../utils';
import { TerminalOutput } from './TerminalCodeBlock';
import {
  LazyLoadedMarkdown,
  defaultCodeComponent,
  terminalCodeComponent,
  LAZY_LOAD_THRESHOLD,
} from './MarkdownCodeBlock';
import { defaultMarkdownComponents } from './markdownUtils';

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
    code: defaultCodeComponent,
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
