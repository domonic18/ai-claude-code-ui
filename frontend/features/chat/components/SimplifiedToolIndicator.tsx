/**
 * SimplifiedToolIndicator Component
 *
 * Renders simplified indicators for frequently used tools (Read, Skill).
 */

import React from 'react';
import { extractFilename, getToolResultData, parseToolInput } from './toolUtils';

export interface SimplifiedToolIndicatorProps {
  toolName: string;
  toolInput: string | null;
  /** 工具结果（Skill 失败时显示 ⚠） */
  toolResult?: any;
  onFileOpen?: (filePath: string) => void;
}

/**
 * SimplifiedToolIndicator Component
 *
 * Displays compact indicators for tools that don't need full rendering.
 */
export function SimplifiedToolIndicator({ toolName, toolInput, toolResult, onFileOpen }: SimplifiedToolIndicatorProps) {
  switch (toolName) {
    case 'Read':
      return <ReadIndicator toolInput={toolInput} onFileOpen={onFileOpen} />;
    case 'Skill':
      return <SkillIndicator toolInput={toolInput} toolResult={toolResult} />;
    default:
      return null;
  }
}

/**
 * Render simplified Read tool indicator
 * 以紧凑的方式展示 Read 工具调用，仅显示文件名而不展开完整路径
 */
function ReadIndicator({ toolInput, onFileOpen }: { toolInput: string | null; onFileOpen?: (filePath: string) => void }) {
  // 验证输入：必须有工具输入字符串
  if (!toolInput) return null;

  // 解析 JSON 格式的工具输入
  const input = parseToolInput(toolInput);
  if (!input?.file_path) return null;

  // 从完整路径中提取文件名（去除目录部分）
  const filename = extractFilename(input.file_path);

  // 渲染紧凑的 Read 工具指示器
  return (
    <div className="bg-muted/30 border-l-2 border-border pl-3 py-2 my-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {/* 书本图标：表示文件读取操作 */}
        <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="font-medium">Read</span>
        {/* 可点击的文件名按钮 */}
        <button
          onClick={() => onFileOpen?.(input.file_path)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-mono transition-colors"
        >
          {filename}
        </button>
      </div>
    </div>
  );
}

/**
 * Render simplified Skill tool indicator
 * 一行展示技能加载：技能名 + 失败 ⚠，无需点击展开
 */
function SkillIndicator({ toolInput, toolResult }: { toolInput: string | null; toolResult?: any }) {
  if (!toolInput) return null;

  const input = parseToolInput(toolInput);
  if (!input?.skill || typeof input.skill !== 'string') return null;

  const { isError } = getToolResultData(toolResult);

  return (
    <div className="bg-muted/30 border-l-2 border-border pl-3 py-2 my-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {/* 闪电图标：表示技能加载 */}
        <svg className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="font-medium">{isError ? '技能加载失败' : '已加载技能'}</span>
        <span className={`font-mono truncate ${isError ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {input.skill}
        </span>
        {isError && <span className="text-red-500 dark:text-red-400 flex-shrink-0">⚠</span>}
      </div>
    </div>
  );
}

export default SimplifiedToolIndicator;
