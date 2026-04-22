/**
 * TerminalCodeBlock Component
 *
 * Terminal-styled code block with copy button.
 * Renders code inside a terminal-like container with a header bar.
 */

// 导入 React 核心依赖
import React from 'react';
// 导入复制按钮组件，用于复制代码内容到剪贴板
import { CopyButton } from './CopyButton';

// TerminalCodeBlock 组件的 Props 接口定义
interface TerminalCodeBlockProps {
  // 要显示的代码内容（用于复制）
  content: string;
  // 自定义 CSS 类名，应用于 <code> 元素
  className?: string;
  // React 子节点，实际要渲染的代码内容
  children?: React.ReactNode;
}

/**
 * TerminalCodeBlock 组件
 *
 * 渲染终端风格的代码块，包含 macOS 风格的红黄绿圆点标题栏和复制按钮
 */
export function TerminalCodeBlock({ content, className, children }: TerminalCodeBlockProps) {
  return (
    <div className="relative group my-2">
      {/* 终端窗口容器 */}
      {/* rounded-lg 圆角、border 边框、bg-gray-950 深色背景、shadow-xl 阴影效果 */}
      <div className="rounded-lg overflow-hidden border border-gray-700/50 bg-gray-950 shadow-xl">
        {/* 终端标题栏 - macOS 风格的红黄绿圆点 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700/50">
          {/* 红黄绿三个圆点按钮 */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          {/* 终端类型标签 */}
          <span className="text-xs text-gray-400 font-medium">terminal</span>
        </div>

        {/* 代码内容区域 */}
        {/* pre 标签保留空白格式，overflow-x-auto 支持横向滚动 */}
        <pre className="p-3 m-0 text-sm leading-relaxed overflow-x-auto">
          <code className={`text-gray-100 font-mono whitespace-pre-wrap break-words ${className || ''}`}>
            {children}
          </code>
        </pre>
      </div>

      {/* 复制按钮 */}
      {/* 默认隐藏，hover 时显示，点击复制 content 到剪贴板 */}
      <CopyButton
        text={content}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-gray-700/80 hover:bg-gray-700 text-white border border-gray-600 flex items-center gap-1"
        title="Copy output"
      />
    </div>
  );
}

// TerminalOutput 组件的 Props 接口定义
interface TerminalOutputProps {
  // 终端输出内容
  content: string;
}

/**
 * TerminalOutput 组件
 *
 * 渲染纯文本终端输出，不包含代码高亮
 */
export function TerminalOutput({ content }: TerminalOutputProps) {
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-700/50 bg-gray-950 shadow-xl">
      {/* 终端标题栏 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700/50">
        {/* macOS 风格的红黄绿圆点 */}
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        {/* 终端标签 */}
        <span className="text-xs text-gray-400 font-medium">terminal</span>
      </div>

      {/* 输出内容 */}
      <pre className="p-3 m-0 text-sm leading-relaxed overflow-x-auto">
        <code className="font-mono text-gray-100 whitespace-pre-wrap break-words">
          {content}
        </code>
      </pre>

      {/* 复制按钮容器 */}
      <div className="relative">
        <CopyButton
          text={content}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-gray-700/80 hover:bg-gray-700 text-white border border-gray-600 flex items-center gap-1"
          title="Copy output"
        />
      </div>
    </div>
  );
}
