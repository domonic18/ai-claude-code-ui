/**
 * Editor Utils
 *
 * Utility functions for code and PRD editor functionality.
 */

import type { EditorLanguage, EditorTheme } from '../types';

/**
 * Language detection utilities
 */
export const LANGUAGE_EXTENSIONS: Record<string, EditorLanguage> = {
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'py': 'python',
  'java': 'java',
  'cpp': 'cpp',
  'c': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  'cs': 'csharp',
  'go': 'go',
  'rs': 'rust',
  'php': 'php',
  'rb': 'ruby',
  'sql': 'sql',
  'yaml': 'yaml',
  'yml': 'yaml',
  'json': 'json',
  'md': 'markdown',
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'scss',
  'xml': 'xml',
  'sh': 'bash',
  'bash': 'bash',
  'dockerfile': 'dockerfile',
  'ps1': 'powershell',
  'psm1': 'powershell',
  'txt': 'text',
};

/**
 * Detect programming language from filename
 */
export function detectLanguageFromFilename(filename: string): EditorLanguage {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) {
    return 'text';
  }

  if (ext in LANGUAGE_EXTENSIONS) {
    return LANGUAGE_EXTENSIONS[ext];
  }

  // Check for Dockerfile
  if (filename.toLowerCase() === 'dockerfile') {
    return 'dockerfile';
  }

  return 'text';
}

/**
 * Detect language from file content (shebang detection)
 */
export function detectLanguageFromContent(content: string): EditorLanguage | null {
  const firstLine = content.split('\n')[0].trim();

  if (!firstLine.startsWith('#!')) {
    return null;
  }

  const shebang = firstLine.slice(2).toLowerCase();

  if (shebang.includes('python')) {
    return 'python';
  }
  if (shebang.includes('bash') || shebang.includes('sh')) {
    return 'bash';
  }
  if (shebang.includes('node')) {
    return 'javascript';
  }
  if (shebang.includes('ruby')) {
    return 'ruby';
  }
  if (shebang.includes('perl')) {
    return 'perl';
  }

  return null;
}

/**
 * Detect language from filename and optional content
 */
export function detectLanguage(filename: string, content?: string): EditorLanguage {
  // First try content detection (shebang)
  if (content) {
    const contentLanguage = detectLanguageFromContent(content);
    if (contentLanguage) {
      return contentLanguage;
    }
  }

  // Fall back to filename detection
  return detectLanguageFromFilename(filename);
}

/**
 * Get file extensions for a language
 */
export function getLanguageExtensions(language: EditorLanguage): string[] {
  const extensions: Record<EditorLanguage, string[]> = {
    javascript: ['.js', '.jsx', '.mjs', '.cjs'],
    typescript: ['.ts', '.tsx', '.mts', '.cts'],
    python: ['.py', '.pyw', '.pyi'],
    java: ['.java'],
    cpp: ['.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx'],
    csharp: ['.cs'],
    go: ['.go'],
    rust: ['.rs'],
    php: ['.php'],
    ruby: ['.rb'],
    perl: ['.pl', '.pm'],
    sql: ['.sql'],
    yaml: ['.yaml', '.yml'],
    json: ['.json'],
    markdown: ['.md', '.markdown'],
    html: ['.html', '.htm'],
    css: ['.css'],
    scss: ['.scss', '.sass'],
    xml: ['.xml'],
    bash: ['.sh', '.bash'],
    powershell: ['.ps1', '.psm1'],
    dockerfile: ['Dockerfile', '.dockerignore'],
    text: ['.txt'],
  };

  return extensions[language] || [];
}

/**
 * Get Monaco editor language identifier
 */
export function getMonacoLanguage(language: EditorLanguage): string {
  const monacoLanguages: Record<EditorLanguage, string> = {
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    java: 'java',
    cpp: 'cpp',
    csharp: 'csharp',
    go: 'go',
    rust: 'rust',
    php: 'php',
    ruby: 'ruby',
    perl: 'perl',
    sql: 'sql',
    yaml: 'yaml',
    json: 'json',
    markdown: 'markdown',
    html: 'html',
    css: 'css',
    scss: 'scss',
    xml: 'xml',
    bash: 'shell',
    powershell: 'powershell',
    dockerfile: 'dockerfile',
    text: 'plaintext',
  };

  return monacoLanguages[language] || 'plaintext';
}

/**
 * Theme utilities
 */
export function getThemeBackgroundColor(theme: EditorTheme): string {
  const bgColors: Record<EditorTheme, string> = {
    light: '#ffffff',
    dark: '#1e1e1e',
    monokai: '#272822',
    solarized: '#fdf6e3',
    dracula: '#282a36',
    nord: '#2e3440',
    github: '#ffffff',
  };

  return bgColors[theme] || '#1e1e1e';
}

export function getThemeForegroundColor(theme: EditorTheme): string {
  const fgColors: Record<EditorTheme, string> = {
    light: '#000000',
    dark: '#d4d4d4',
    monokai: '#f8f8f2',
    solarized: '#657b83',
    dracula: '#f8f8f2',
    nord: '#d8dee9',
    github: '#24292e',
  };

  return fgColors[theme] || '#d4d4d4';
}

/**
 * Code formatting utilities
 */
export function formatJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return json;
  }
}

export function minifyJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed);
  } catch {
    return json;
  }
}

/**
 * Check if a file is binary
 */
export function isBinaryFile(content: string, filename: string): boolean {
  // Check common binary extensions
  const binaryExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.wav', '.ogg', '.flac',
    '.ttf', '.otf', '.woff', '.woff2',
    '.class', '.jar',
  ];

  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && binaryExtensions.includes(`.${ext}`)) {
    return true;
  }

  // Check for null bytes (indicates binary)
  if (content.includes('\0')) {
    return true;
  }

  // Heuristic: if more than 5% of characters are non-printable, likely binary
  const nonPrintable = (content.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
  if (content.length > 0 && nonPrintable / content.length > 0.05) {
    return true;
  }

  return false;
}

/**
 * Calculate line and column from position
 */
export function getPositionFromOffset(content: string, offset: number): { line: number; column: number } {
  const lines = content.substring(0, offset).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * Calculate offset from line and column
 */
export function getOffsetFromPosition(content: string, line: number, column: number): number {
  const lines = content.split('\n');
  let offset = 0;

  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }

  return offset + column - 1;
}

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
 * Get file icon info
 */
export function getFileIconInfo(filename: string): {
  icon: string;
  color: string;
  category: string;
} {
  const ext = filename.split('.').pop()?.toLowerCase();
  const name = filename.toLowerCase();

  // Icons
  const icons: Record<string, string> = {
    js: 'javascript',
    jsx: 'react',
    ts: 'typescript',
    tsx: 'react',
    py: 'python',
    java: 'java',
    cpp: 'code',
    c: 'code',
    h: 'code',
    cs: 'code',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    sql: 'database',
    yaml: 'settings',
    yml: 'settings',
    json: 'code',
    md: 'markdown',
    html: 'code',
    htm: 'code',
    css: 'code',
    scss: 'code',
    sass: 'code',
    xml: 'code',
    sh: 'terminal',
    bash: 'terminal',
    dockerfile: 'docker',
    ps1: 'powershell',
    psm1: 'powershell',
    txt: 'file',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    svg: 'image',
    pdf: 'file',
    zip: 'zip',
  };

  // Colors
  const colors: Record<string, string> = {
    javascript: '#f7df1e',
    typescript: '#3178c6',
    react: '#61dafb',
    python: '#3776ab',
    java: '#b07219',
    go: '#00add8',
    rust: '#dea584',
    php: '#777bb4',
    ruby: '#cc342d',
    html: '#e34c26',
    css: '#563d7c',
    json: '#f7df1e',
    markdown: '#083fa1',
    docker: '#2496ed',
    default: '#6e7681',
  };

  // Categories
  const categories: Record<string, string> = {
    javascript: 'frontend',
    typescript: 'frontend',
    react: 'frontend',
    python: 'backend',
    java: 'backend',
    go: 'backend',
    rust: 'backend',
    php: 'backend',
    ruby: 'backend',
    html: 'frontend',
    css: 'frontend',
    sql: 'database',
    docker: 'devops',
    default: 'file',
  };

  // Determine icon, color, and category
  let icon = icons[ext || ''] || 'file';
  let color = colors[ext || ''] || colors.default;
  let category = categories[ext || ''] || categories.default;

  // Special cases
  if (name === 'dockerfile') {
    icon = 'docker';
    color = colors.docker;
    category = 'devops';
  }
  if (name === 'package.json') {
    icon = 'npm';
    color = '#cb3837';
  }
  if (name === 'tsconfig.json') {
    icon = 'typescript';
    color = colors.typescript;
  }
  if (name === 'readme.md') {
    icon = 'markdown';
    category = 'docs';
  }

  return { icon, color, category };
}

/**
 * Validate code syntax (basic validation)
 */
export function validateCodeSyntax(code: string, language: EditorLanguage): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for basic syntax issues
  if (language === 'json') {
    try {
      JSON.parse(code);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  // Check for unbalanced brackets
  const brackets: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  const openBrackets = Object.keys(brackets);
  const closeBrackets = Object.values(brackets);

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

  return {
    valid: errors.length === 0,
    errors,
  };
}

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
