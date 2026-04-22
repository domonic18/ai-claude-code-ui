/**
 * MarkdownCodeBlock Component
 *
 * Handles code block rendering and lazy loading for markdown content.
 *
 * @module features/chat/components/MarkdownCodeBlock
 */

// 导入 React 核心依赖和 Hooks（状态、缓存、引用、副作用）
import React, { useState, useMemo, useRef, useEffect } from 'react';
// 导入 ReactMarkdown 组件，用于将 Markdown 转换为 React 元素
import ReactMarkdown from 'react-markdown';
// 导入 Markdown 渲染器 Props 类型定义
import type { MarkdownRendererProps } from '../types';
// 导入复制按钮组件，用于代码块一键复制
import { CopyButton } from './CopyButton';
// 导入终端风格代码块组件，用于 bash/shell 代码渲染
import { TerminalCodeBlock } from './TerminalCodeBlock';

// 懒加载阈值：10KB
// 超过此大小的 Markdown 内容会使用懒加载策略，避免一次性渲染大量 KaTeX 公式导致 UI 卡顿
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
  // 展开状态：false=显示预览，true=显示完整内容
  const [isExpanded, setIsExpanded] = useState(false);
  // 渲染状态：false=渲染中，true=渲染完成
  const [isRendered, setIsRendered] = useState(false);
  // 渲染定时器引用，用于延迟渲染（50ms 后显示完整内容）
  const renderTimeoutRef = useRef<NodeJS.Timeout>();

  // 预览内容计算：使用 useMemo 缓存预览内容，避免每次渲染都重新计算
  // 仅显示前 500 字符，超出部分添加省略提示
  const preview = useMemo(() => {
    // 将内容按行分割
    const lines = content.split('\n');
    let previewLength = 0;
    const previewLines: string[] = [];

    // 逐行追加，直到达到 500 字符限制
    for (const line of lines) {
      previewLines.push(line);
      previewLength += line.length + 1;  // +1 是换行符
      if (previewLength > 500) break;
    }

    // 添加中文省略提示
    return previewLines.join('\n') + '\n\n... *(内容过长，点击"查看完整内容"加载)*';
  }, [content]);

  /**
   * 展开状态变化的副作用
   *
   * 当用户点击"查看完整内容"时，延迟 50ms 后设置 isRendered
   * 延迟的目的是确保 UI 先显示加载动画，再执行昂贵的 KaTeX 渲染
   */
  useEffect(() => {
    if (!isExpanded) return;

    // 延迟 50ms 后标记为已渲染
    renderTimeoutRef.current = setTimeout(() => {
      setIsRendered(true);
    }, 50);

    // 清理函数：组件卸载或收起时取消定时器
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
