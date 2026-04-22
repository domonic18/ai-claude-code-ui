/**
 * Editor Core Utils
 *
 * Core utility functions for code and PRD editor functionality:
 * - Theme utilities
 * - JSON formatting
 * - Binary file detection
 * - Position/offset calculation
 * - Code truncation
 * - Syntax validation
 * - Word extraction
 */

import type { EditorLanguage, EditorTheme } from '../types';

// ─── Theme utilities ────────────────────────────────────
// 主题背景色映射：支持 7 种编辑器主题
const THEME_BG_COLORS: Record<EditorTheme, string> = {
  light: '#ffffff',
  dark: '#1e1e1e',
  monokai: '#272822',
  solarized: '#fdf6e3',
  dracula: '#282a36',
  nord: '#2e3440',
  github: '#ffffff',
};

// 主题前景色映射：文本颜色
const THEME_FG_COLORS: Record<EditorTheme, string> = {
  light: '#000000',
  dark: '#d4d4d4',
  monokai: '#f8f8f2',
  solarized: '#657b83',
  dracula: '#f8f8f2',
  nord: '#d8dee9',
  github: '#24292e',
};

// CodeEditor 组件调用此函数获取主题背景颜色
/**
 * Get theme background color
 */
export function getThemeBackgroundColor(theme: EditorTheme): string {
  return THEME_BG_COLORS[theme] || '#1e1e1e';
}

// CodeEditor 组件调用此函数获取主题前景颜色
/**
 * Get theme foreground color
 */
export function getThemeForegroundColor(theme: EditorTheme): string {
  return THEME_FG_COLORS[theme] || '#d4d4d4';
}

// ─── JSON utilities ─────────────────────────────────────
// JSON 编辑功能调用此函数格式化 JSON 字符串
/**
 * Format JSON string with pretty printing
 */
export function formatJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return json;
  }
}

// JSON 编辑功能调用此函数压缩 JSON 字符串
/**
 * Minify JSON string
 */
export function minifyJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed);
  } catch {
    return json;
  }
}

// ─── Binary detection ───────────────────────────────────
// 二进制文件扩展名集合：图片、文档、压缩包、可执行文件、音视频、字体
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.ogg', '.flac',
  '.ttf', '.otf', '.woff', '.woff2',
  '.class', '.jar',
]);

// 文件查看器调用此函数检查文件是否为二进制文件
/**
 * Check if a file is binary
 */
export function isBinaryFile(content: string, filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && BINARY_EXTENSIONS.has(`.${ext}`)) {
    return true;
  }

  // 检查文件内容是否包含空字节（二进制文件特征）
  if (content.includes('\0')) {
    return true;
  }

  // Heuristic: if more than 5% of characters are non-printable, likely binary
  const nonPrintable = (content.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
  return content.length > 0 && nonPrintable / content.length > 0.05;
}

// ─── Position/offset utilities ──────────────────────────
// 编辑器导航功能调用此函数将偏移量转换为行列号
/**
 * Calculate line and column from offset
 */
export function getPositionFromOffset(content: string, offset: number): { line: number; column: number } {
  const lines = content.substring(0, offset).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

// 编辑器导航功能调用此函数将行列号转换为偏移量
/**
 * Calculate offset from line and column
 */
export function getOffsetFromPosition(content: string, line: number, column: number): number {
  const lines = content.split('\n');
  let offset = 0;

  // 累加前面所有行的长度（包含换行符）
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }

  return offset + column - 1;
}

// ─── Code utilities ─────────────────────────────────────
// 代码预览功能调用此函数截断代码到指定行数
/**
 * Truncate code for preview
 */
export function truncateCode(code: string, maxLines: number = 10): string {
  const lines = code.split('\n');
  if (lines.length <= maxLines) {
    return code;
  }

  return lines.slice(0, maxLines).join('\n') + '\n// ... (truncated)';
}

/**
 * Check unbalanced brackets in code
 * 检查代码中的括号平衡：圆括号、方括号、花括号
 */
function checkBrackets(code: string): string[] {
  const errors: string[] = [];
  const brackets: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  const openBrackets = Object.keys(brackets);
  const closeBrackets = Object.values(brackets);

  // 遍历代码字符，检查括号匹配
  for (const char of code) {
    if (openBrackets.includes(char)) {
      stack.push(char);
    } else if (closeBrackets.includes(char)) {
      const last = stack.pop();
      if (!last || brackets[last] !== char) {
        errors.push(`Unbalanced bracket: ${char}`);
      }
    }
  }

  if (stack.length > 0) {
    errors.push(`Unclosed bracket: ${stack[stack.length - 1]}`);
  }

  return errors;
}

// 代码编辑器调用此函数验证代码语法（括号平衡、JSON 格式等）
/**
 * Validate code syntax (basic validation)
 */
export function validateCodeSyntax(code: string, language: EditorLanguage): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // JSON 特殊验证：尝试解析 JSON 字符串
  if (language === 'json') {
    try {
      JSON.parse(code);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  // 所有语言都进行括号平衡检查
  errors.push(...checkBrackets(code));

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 编辑器调用此函数获取光标位置的单词
/**
 * Get word at position
 */
export function getWordAtPosition(content: string, offset: number): string {
  const before = content.substring(0, offset);
  const after = content.substring(offset);

  const beforeMatch = before.match(/[a-zA-Z0-9_]+$/);
  const afterMatch = after.match(/^[a-zA-Z0-9_]+/);

  const beforeWord = beforeMatch ? beforeMatch[0] : '';
  const afterWord = afterMatch ? afterMatch[0] : '';

  return beforeWord + afterWord;
}
