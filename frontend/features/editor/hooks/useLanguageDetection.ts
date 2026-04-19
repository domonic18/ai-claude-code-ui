/**
 * Language Detection Hook
 *
 * Hook for detecting file language from filename and content.
 */

import { useCallback } from 'react';
import type { EditorLanguage } from '../types';

export interface UseLanguageDetectionReturn {
  detectLanguage: (filename: string, content?: string) => EditorLanguage;
  getLanguageExtension: (language: EditorLanguage) => string[];
}

const LANGUAGE_MAP: Record<string, EditorLanguage> = {
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'py': 'python',
  'java': 'java',
  'cpp': 'cpp',
  'c': 'cpp',
  'h': 'cpp',
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
};

/**
 * Hook for detecting file language
 */
export function useLanguageDetection(): UseLanguageDetectionReturn {
  /**
   * Detect language from filename and optional content
   */
  const detectLanguage = useCallback((filename: string, content?: string): EditorLanguage => {
    // Get extension
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) {
      return 'text';
    }

    // Check extension map
    if (ext in LANGUAGE_MAP) {
      return LANGUAGE_MAP[ext];
    }

    // Try to detect from content (shebang)
    if (content) {
      const firstLine = content.split('\n')[0].trim();
      if (firstLine.startsWith('#!')) {
        const shebang = firstLine.slice(2).toLowerCase();
        if (shebang.includes('python')) return 'python';
        if (shebang.includes('bash') || shebang.includes('sh')) return 'bash';
        if (shebang.includes('node')) return 'javascript';
        if (shebang.includes('ruby')) return 'ruby';
        if (shebang.includes('perl')) return 'perl';
      }
    }

    return 'text';
  }, []);

  /**
   * Get file extensions for a language
   */
  const getLanguageExtension = useCallback((language: EditorLanguage): string[] => {
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
  }, []);

  return {
    detectLanguage,
    getLanguageExtension,
  };
}
