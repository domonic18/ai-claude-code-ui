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

/**
 * Get provider from localStorage
 * @returns Provider name ('claude' | 'cursor' | 'codex')
 */
export function getProvider(): string {
  if (typeof window === 'undefined') return 'claude';
  return localStorage.getItem('selected-provider') || 'claude';
}

/**
 * Check if tool should be displayed in minimized format
 * @param toolName - Name of the tool
 * @returns True if tool is minimized
 */
export function isMinimizedTool(toolName: string): boolean {
  const MINIMIZED_TOOLS = ['Grep', 'Glob'];
  return MINIMIZED_TOOLS.includes(toolName);
}

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

/**
 * Extract filename from file path
 * @param filePath - File path string
 * @returns Filename or empty string
 */
export function extractFilename(filePath: string): string {
  if (!filePath) return '';
  return filePath.split('/').pop() || '';
}
