/**
 * Tool Utilities
 *
 * Utility functions for parsing and handling tool inputs/outputs.
 */

/**
 * Parse tool input safely
 * @param toolInput - Tool input string or object
 * @returns Parsed input object or null
 */
export function parseToolInput(toolInput: string | null): any {
  if (!toolInput) return null;
  try {
    return typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput;
  } catch {
    return null;
  }
}

// ToolResultRenderer 组件调用此函数提取工具结果内容和错误状态
/**
 * Get tool result content and error status
 * @param toolResult - Tool result object
 * @returns Object with content and error status
 */
export function getToolResultData(toolResult: any): { content: string; isError: boolean } {
  if (typeof toolResult === 'object' && toolResult !== null) {
    return {
      content: toolResult.content || '',
      isError: toolResult.isError || false,
    };
  }
  return {
    content: String(toolResult || ''),
    isError: false,
  };
}

// 各个工具调用和消息处理函数调用此函数获取当前选中的 AI 提供商
/**
 * Get provider from localStorage
 * @returns Provider name ('claude' | 'cursor' | 'codex')
 */
export function getProvider(): string {
  if (typeof window === 'undefined') return 'claude';
  return localStorage.getItem('selected-provider') || 'claude';
}

// ChatMessageList 组件调用此函数判断工具是否应以紧凑模式显示
/**
 * Check if tool should be displayed in minimized format
 * @param toolName - Name of the tool
 * @returns True if tool is minimized
 */
export function isMinimizedTool(toolName: string): boolean {
  const MINIMIZED_TOOLS = ['Grep', 'Glob'];
  return MINIMIZED_TOOLS.includes(toolName);
}

// ChatMessageList 组件调用此函数判断是否应隐藏某些工具的结果
/**
 * Check if tool result should be hidden
 * @param toolName - Name of the tool
 * @param isError - Whether the result is an error
 * @returns True if result should be hidden
 */
export function shouldHideToolResult(toolName: string, isError: boolean): boolean {
  const toolsWithHiddenResult = ['Edit', 'Write', 'ApplyPatch', 'Bash'];
  return !isError && toolsWithHiddenResult.includes(toolName);
}

// DiffViewer 和文件相关组件调用此函数从路径提取文件名
/**
 * Extract filename from file path
 * @param filePath - File path string
 * @returns Filename or empty string
 */
export function extractFilename(filePath: string): string {
  if (!filePath) return '';
  return filePath.split('/').pop() || '';
}
