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
  // JavaScript 生态
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  // Python 生态
  'py': 'python',
  // Java 生态
  'java': 'java',
  // C/C++ 生态
  'cpp': 'cpp',
  'c': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  // C# 生态
  'cs': 'csharp',
  // Go 生态
  'go': 'go',
  // Rust 生态
  'rs': 'rust',
  // PHP 生态
  'php': 'php',
  // Ruby 生态
  'rb': 'ruby',
  // 数据库
  'sql': 'sql',
  // 配置文件
  'yaml': 'yaml',
  'yml': 'yaml',
  'json': 'json',
  // 文档
  'md': 'markdown',
  // 前端技术
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'scss',
  'xml': 'xml',
  // 脚本语言
  'sh': 'bash',
  'bash': 'bash',
  'dockerfile': 'dockerfile',
  'ps1': 'powershell',
  'psm1': 'powershell',
  // 纯文本
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
 * Shebang 格式：#!/path/to/interpreter
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
 * 优先级高于文件扩展名检测
 * @param content - 文件内容
 * @returns 检测到的编程语言，无 shebang 则返回 null
 */
export function detectLanguageFromContent(content: string): EditorLanguage | null {
  const firstLine = content.split('\n')[0].trim();

  // 检查是否为 shebang 行（必须以 #! 开头）
  if (!firstLine.startsWith('#!')) {
    return null;
  }

  // 移除 #! 前缀，提取解释器路径
  const shebang = firstLine.slice(2).toLowerCase();

  // 查找匹配的 shebang 模式
  // 使用 includes 而不是精确匹配，因为路径可能不同（如 /usr/bin/python vs /usr/local/bin/python3）
  for (const { pattern, language } of SHEBANG_LANGUAGES) {
    if (shebang.includes(pattern)) {
      return language;
    }
  }

  return null;
}

/**
 * 综合检测编程语言：优先使用 shebang，其次使用文件扩展名
 * 这是最常用的语言检测函数，组合了多种检测策略
 * @param filename - 文件名
 * @param content - 文件内容（可选）
 * @returns 检测到的编程语言
 */
export function detectLanguage(filename: string, content?: string): EditorLanguage {
  // 优先使用 shebang 检测（适用于无扩展名的脚本文件）
  // Shebang 检测更准确，因为它明确指定了解释器
  if (content) {
    const contentLanguage = detectLanguageFromContent(content);
    if (contentLanguage) {
      return contentLanguage;
    }
  }

  // 回退到文件扩展名检测
  // 这是最常用的检测方式，适用于大多数文件
  return detectLanguageFromFilename(filename);
}

/**
 * 获取指定编程语言关联的所有文件扩展名
 * 用于文件过滤器、语言选择器等场景
 * @param language - 编程语言
 * @returns 文件扩展名数组（包含点号）
 */
export function getLanguageExtensions(language: EditorLanguage): string[] {
  const extensions: Record<EditorLanguage, string[]> = {
    // JavaScript 模块：CommonJS、ES Module、JSX
    javascript: ['.js', '.jsx', '.mjs', '.cjs'],
    // TypeScript 模块：TSX、MTS、CTS
    typescript: ['.ts', '.tsx', '.mts', '.cts'],
    // Python：.pyw（Windows GUI）、.pyi（存根文件）
    python: ['.py', '.pyw', '.pyi'],
    // Java
    java: ['.java'],
    // C++：源文件和头文件
    cpp: ['.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx'],
    // C#
    csharp: ['.cs'],
    // Go
    go: ['.go'],
    // Rust
    rust: ['.rs'],
    // PHP
    php: ['.php'],
    // Ruby
    ruby: ['.rb'],
    // Perl：.pl（脚本）、.pm（模块）
    perl: ['.pl', '.pm'],
    // SQL
    sql: ['.sql'],
    // YAML 配置
    yaml: ['.yaml', '.yml'],
    // JSON 配置
    json: ['.json'],
    // Markdown 文档
    markdown: ['.md', '.markdown'],
    // HTML 网页
    html: ['.html', '.htm'],
    // CSS 样式
    css: ['.css'],
    // SCSS 样式
    scss: ['.scss', '.sass'],
    // XML 数据
    xml: ['.xml'],
    // Bash 脚本
    bash: ['.sh', '.bash'],
    // PowerShell 脚本：.ps1（脚本）、.psm1（模块）
    powershell: ['.ps1', '.psm1'],
    // Docker 配置
    dockerfile: ['Dockerfile', '.dockerignore'],
    // 纯文本
    text: ['.txt'],
  };

  return extensions[language] || [];
}

/**
 * 将内部编程语言标识符映射到 Monaco Editor 支持的语言 ID
 * Monaco Editor 使用不同的语言标识符（如 'shell' 而非 'bash'）
 * 此函数用于兼容使用 Monaco Editor 的场景
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
    bash: 'shell',          // Monaco 使用 'shell' 而非 'bash'
    powershell: 'powershell',
    dockerfile: 'dockerfile',
    text: 'plaintext',      // Monaco 使用 'plaintext' 而非 'text'
  };

  // 默认返回 'plaintext'，避免 Monaco 报错
  return monacoLanguages[language] || 'plaintext';
}
