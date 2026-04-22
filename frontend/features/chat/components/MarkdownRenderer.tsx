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

// 导入 React 核心依赖，用于组件构建和性能优化
import React, { useMemo } from 'react';
// ReactMarkdown - 将 Markdown 文本转换为 React 组件的核心库
import ReactMarkdown from 'react-markdown';
// remarkGfm - GitHub Flavored Markdown 插件，支持表格、删除线等语法
import remarkGfm from 'remark-gfm';
// remarkMath - 数学公式语法插件，解析 $...$ 和 $$...$$ 公式标记
import remarkMath from 'remark-math';
// rehypeKatex - KaTeX 渲染插件，将数学公式转换为可渲染的 HTML
import rehypeKatex from 'rehype-katex';
// 导入组件 Props 类型定义
import type { MarkdownRendererProps } from '../types';
// 导入 Markdown 预处理工具：规范化代码围栏、反转义并保护数学公式
import { normalizeInlineCodeFences, unescapeWithMathProtection } from '../utils';
// 导入终端输出组件，用于渲染 bash/shell 命令结果
import { TerminalOutput } from './TerminalCodeBlock';
// 导入懒加载组件、代码块渲染组件和阈值常量
import {
  LazyLoadedMarkdown,
  defaultCodeComponent,
  terminalCodeComponent,
  LAZY_LOAD_THRESHOLD,
} from './MarkdownCodeBlock';
// 导入默认的 Markdown 组件映射，用于自定义渲染规则
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
  // 预处理 Markdown 内容：规范化内联代码围栏，反转义 HTML 实体并保护数学公式
  // 使用 useMemo 避免每次渲染都重复处理，提升性能
  const processedContent = useMemo(() => {
    if (!content) return '';
    const normalized = normalizeInlineCodeFences(String(content));
    return unescapeWithMathProtection(normalized);
  }, [content]);

  // 配置 remark 插件列表（Markdown 语法解析阶段）
  // 基础插件：remarkGfm 支持 GitHub 风格的表格、删除线、任务列表等
  // 可选插件：remarkMath 支持数学公式语法（$...$ 和 $$...$$）
  const remarkPlugins = useMemo(() => {
    const plugins: any[] = [remarkGfm];
    if (enableMath) {
      plugins.push(remarkMath);
    }
    return plugins;
  }, [enableMath]);

  // 配置 rehype 插件列表（HTML 转换阶段）
  // 可选插件：rehypeKatex 将数学公式渲染为 KaTeX HTML，strict:false 允许非标准语法
  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [];
    if (enableMath) {
      plugins.push([rehypeKatex, { strict: false }]);
    }
    return plugins;
  }, [enableMath]);

  // 合并默认组件和自定义组件
  // 用户传入的 customComponents 会覆盖默认组件（如 code、pre 等）
  const markdownComponents = useMemo(() => ({
    ...defaultMarkdownComponents,
    code: defaultCodeComponent,
    ...customComponents,
  }), [customComponents]);

  // 终端输出模式：使用专门的终端样式渲染器
  // 适用于 bash/shell 命令执行结果的展示，带有终端窗口风格的 UI
  if (isTerminalOutput) {
    return (
      <TerminalMarkdownRenderer
        content={processedContent}
        className={className}
      />
    );
  }

  // 检查内容是否超过懒加载阈值（10KB）
  // 大文件使用懒加载策略，避免一次性渲染大量 KaTeX 公式导致 UI 卡顿
  const isLargeContent = processedContent.length > LAZY_LOAD_THRESHOLD;

  // 大内容 + 启用数学公式：使用懒加载组件
  // 首次只渲染预览，用户点击后再渲染完整内容
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

  // 普通内容：直接使用 ReactMarkdown 渲染
  // 应用所有配置的插件和组件覆盖规则
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
  // 检查内容是否以 Markdown 代码围栏（```）开头
  // 有代码围栏：使用 ReactMarkdown 渲染，支持嵌套的 Markdown 语法
  // 无代码围栏：直接作为纯文本渲染到终端样式的容器中
  const hasCodeBlockFence = content.trim().startsWith('```');

  // 配置终端模式的组件映射
  // 使用 terminalCodeComponent 替换默认的 code 组件，提供终端窗口风格的代码块
  const terminalComponents = useMemo(() => ({
    ...defaultMarkdownComponents,
    code: terminalCodeComponent,
  }), []);

  // 有代码围栏：使用 ReactMarkdown 渲染
  // 仅启用 remarkGfm 插件（表格、删除线等），不启用数学公式
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

  // 无代码围栏：直接使用 TerminalOutput 组件渲染纯文本
  // 渲染为终端窗口样式的输出，包含 macOS 风格的红黄绿圆点标题栏
  return (
    <div className={className}>
      <TerminalOutput content={content} />
    </div>
  );
}

export default MarkdownRenderer;
