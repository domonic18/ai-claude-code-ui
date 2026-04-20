/**
 * Language Detection Utils
 *
 * Language detection, mapping, and Monaco editor integration utilities.
 */

import type { EditorLanguage } from '../types';

/**
 * Language extension mapping
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
 * Shebang to language mapping
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
 * Detect language from file content (shebang detection)
 */
export function detectLanguageFromContent(content: string): EditorLanguage | null {
  const firstLine = content.split('\n')[0].trim();

  if (!firstLine.startsWith('#!')) {
    return null;
  }

  const shebang = firstLine.slice(2).toLowerCase();

  for (const { pattern, language } of SHEBANG_LANGUAGES) {
    if (shebang.includes(pattern)) {
      return language;
    }
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
 * Monaco editor language identifier mapping
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
