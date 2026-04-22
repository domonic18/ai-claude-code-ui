/**
 * Language Detection Utils
 *
 * 语言检测、映射和 Monaco 编辑器集成工具
 * 支持根据文件扩展名和 shebang 检测编程语言
 */

import type { EditorLanguage } from '../types';

/**
 * 文件扩展名到编程语言的映射表
 * 用于根据文件扩展名自动识别编程语言
 * 覆盖 40+ 种文件扩展名
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
 * 根据文件名检测编程语言
 * 优先使用文件扩展名，特殊处理 Dockerfile
 * @param filename - 文件名
 * @returns 检测到的编程语言，无法识别则返回 'text'
 */
export function detectLanguageFromFilename(filename: string): EditorLanguage {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) {
    return 'text';
  }

  if (ext in LANGUAGE_EXTENSIONS) {
    return LANGUAGE_EXTENSIONS[ext];
  }

  // 特殊处理：Dockerfile 无扩展名
  if (filename.toLowerCase() === 'dockerfile') {
    return 'dockerfile';
  }

  return 'text';
}

/**
 * Shebang（脚本文件第一行）到编程语言的映射表
 * 用于识别无扩展名的脚本文件语言
 * 支持 Python、Bash、Node、Ruby、Perl 等脚本
 */
const SHEBANG_LANGUAGES: Array<{ pattern: string; language: EditorLanguage }> = [
  { pattern: 'python', language: 'python' },
  { pattern: 'bash', language: 'bash' },
  { pattern: 'sh', language: 'bash' },
  { pattern: 'node', language: 'javascript' },
  { pattern: 'ruby', language: 'ruby' },
  { pattern: 'perl', language: 'perl' },
];

/**
 * 根据文件内容（shebang）检测编程语言
 * @param content - 文件内容
 * @returns 检测到的编程语言，无 shebang 则返回 null
 */
export function detectLanguageFromContent(content: string): EditorLanguage | null {
  const firstLine = content.split('\n')[0].trim();

  // 检查是否为 shebang 行（必须以 #! 开头）
  if (!firstLine.startsWith('#!')) {
    return null;
  }

  const shebang = firstLine.slice(2).toLowerCase();

  // 查找匹配的 shebang 模式
  for (const { pattern, language } of SHEBANG_LANGUAGES) {
    if (shebang.includes(pattern)) {
      return language;
    }
  }

  return null;
}

/**
 * 综合检测编程语言：优先使用 shebang，其次使用文件扩展名
 * @param filename - 文件名
 * @param content - 文件内容（可选）
 * @returns 检测到的编程语言
 */
export function detectLanguage(filename: string, content?: string): EditorLanguage {
  // 优先使用 shebang 检测（适用于无扩展名的脚本文件）
  if (content) {
    const contentLanguage = detectLanguageFromContent(content);
    if (contentLanguage) {
      return contentLanguage;
    }
  }

  // 回退到文件扩展名检测
  return detectLanguageFromFilename(filename);
}

/**
 * 获取指定编程语言关联的所有文件扩展名
 * @param language - 编程语言
 * @returns 文件扩展名数组（包含点号）
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
 * 将内部编程语言标识符映射到 Monaco Editor 支持的语言 ID
 * @param language - 内部编程语言标识符
 * @returns Monaco Editor 语言 ID
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
