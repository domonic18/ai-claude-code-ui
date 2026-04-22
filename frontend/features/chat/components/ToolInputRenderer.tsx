/**
 * ToolInputRenderer Component
 *
 * Renders tool input for various AI tools (Bash, Read, Edit, Write, etc.).
 *
 * 组件职责：
 * 1. 根据工具类型（Bash/Read/Edit/Write/其他）分发到对应的渲染函数
 * 2. Bash 工具：显示命令行样式（终端样式）
 * 3. Read 工具：显示文件路径和可点击的文件名
 * 4. Edit 工具：显示文件编辑差异对比（DiffViewer）
 * 5. Write 工具：显示新文件创建的差异对比
 * 6. 其他工具：显示原始输入（CollapsiblePanel 可折叠面板）
 *
 * 工具类型映射：
 * - Bash → BashInput（命令行）
 * - Read → ReadInput（文件读取）
 * - Edit → EditInput（文件编辑）
 * - Write → WriteInput（文件写入）
 * - 其他 → DefaultInput（默认显示）
 */

import React from 'react';
import { parseToolInput, extractFilename } from './toolUtils';
import { CollapsiblePanel } from './CollapsiblePanel';
import { DiffViewer } from './DiffViewer';

export interface ToolInputRendererProps {
  toolName: string;
  toolInput: string | null;
  onFileOpen?: (filePath: string, diffData?: any) => void;
}

/**
 * ToolInputRenderer Component
 *
 * Dispatches rendering to appropriate sub-component based on tool type.
 *
 * 主渲染函数：根据工具名称分发到对应的子组件
 */
export function ToolInputRenderer({ toolName, toolInput, onFileOpen }: ToolInputRendererProps) {
  const input = parseToolInput(toolInput);
  if (!input) return null;

  // 根据工具名称分发到对应的渲染函数
  switch (toolName) {
    case 'Bash':
      return <BashInput input={input} />;
    case 'Read':
      return <ReadInput input={input} onFileOpen={onFileOpen} />;
    case 'Edit':
      return <EditInput input={input} onFileOpen={onFileOpen} />;
    case 'Write':
      return <WriteInput input={input} onFileOpen={onFileOpen} />;
    default:
      return <DefaultInput toolInput={toolInput} />;
  }
}

// ========== 工具特定渲染函数 ==========

/**
 * Render Bash tool input as command line
 *
 * Bash 工具渲染：显示终端样式的命令行
 * - 绿色的 $ 提示符
 * - 黑色背景的命令区域
 * - 可选的命令描述（灰色斜体）
 */
function BashInput({ input }: { input: any }) {
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
 *
 * Read 工具渲染：显示可点击的文件名
 * - "Read " 前缀文本
 * - 蓝色可点击的文件名按钮
 * - 点击后触发 onFileOpen 回调
 */
function ReadInput({ input, onFileOpen }: { input: any; onFileOpen?: (filePath: string) => void }) {
  if (!input?.file_path) return null;

  const filename = extractFilename(input.file_path);

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
 *
 * Edit 工具渲染：显示文件编辑的差异对比
 * - 可折叠的面板（CollapsiblePanel）
 * - 面板标题：编辑图标 + "Editing file" + 可点击的文件名
 * - DiffViewer 组件显示 old_string 和 new_string 的对比
 * - 支持点击文件名打开文件（带 diff 数据）
 */
function EditInput({ input, onFileOpen }: { input: any; onFileOpen?: (filePath: string, diffData?: any) => void }) {
  if (!input?.file_path || input?.old_string === undefined || input?.new_string === undefined) {
    return null;
  }

  const filename = extractFilename(input.file_path);

  return (
    <CollapsiblePanel
      title={
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2h2.828l8.586-8.586z" />
          </svg>
          <span>Editing file</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFileOpen?.(input.file_path, { old_string: input.old_string, new_string: input.new_string });
            }}
            className="ml-2 px-2 py-0.5 rounded bg-white/60 dark:bg-gray-800/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:text-blue-900/30 font-mono text-xs"
          >
            {filename}
          </button>
        </>
      }
      className="relative mt-3"
    >
      <DiffViewer
        oldContent={input.old_string}
        newContent={input.new_string}
        filePath={input.file_path}
        subtitle="Diff"
        onFileOpen={onFileOpen}
      />
    </CollapsiblePanel>
  );
}

/**
 * Render Write tool input with diff view
 *
 * Write 工具渲染：显示新文件创建的差异对比
 * - 可折叠的面板（CollapsiblePanel）
 * - 面板标题：文件图标 📄 + "Creating new file:" + 可点击的文件名
 * - DiffViewer 组件显示空内容和新内容的对比
 * - 支持点击文件名打开文件（带完整内容）
 */
function WriteInput({ input, onFileOpen }: { input: any; onFileOpen?: (filePath: string, diffData?: any) => void }) {
  if (!input?.file_path || input?.content === undefined) {
    return null;
  }

  const filename = extractFilename(input.file_path);

  return (
    <CollapsiblePanel
      title={
        <>
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
            {filename}
          </button>
        </>
      }
      className="relative mt-3"
    >
      <DiffViewer
        oldContent=""  // New file has no old content
        newContent={input.content}
        filePath={input.file_path}
        subtitle="New File"
        onFileOpen={onFileOpen}
      />
    </CollapsiblePanel>
  );
}

/**
 * Render default tool input
 *
 * 默认工具渲染：显示原始输入内容
 * - 可折叠的面板（CollapsiblePanel）
 * - "Tool Input" 标题
 * - 预格式化的代码块显示（<pre><code>）
 * - 适用于不支持的或未知工具类型
 */
function DefaultInput({ toolInput }: { toolInput: string }) {
  return (
    <CollapsiblePanel title="Tool Input" className="relative mt-3">
      <pre className="mt-2 text-xs bg-white dark:bg-gray-900 p-3 rounded overflow-x-auto">
        <code>{toolInput}</code>
      </pre>
    </CollapsiblePanel>
  );
}

export default ToolInputRenderer;
