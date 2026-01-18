/**
 * Code Editor Hooks
 *
 * Custom hooks for code editor functionality.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  CodeEditorComponentProps,
  CodeEditorConfig,
  EditorLanguage,
  EditorTheme,
  EditorFile
} from '../types';

/**
 * Hook for code editor functionality
 */
export interface UseCodeEditorOptions {
  file?: EditorFile;
  projectPath?: string;
  onSave?: (content: string) => Promise<void>;
  readOnly?: boolean;
}

export interface UseCodeEditorReturn {
  config: CodeEditorConfig;
  content: string;
  language: EditorLanguage;
  theme: EditorTheme;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  fontSize: number;
  isSaving: boolean;
  saveSuccess: boolean;
  updateConfig: (updates: Partial<CodeEditorConfig>) => void;
  setTheme: (theme: EditorTheme) => void;
  setLanguage: (language: EditorLanguage) => void;
  setFontSize: (size: number) => void;
  setWordWrap: (enabled: boolean) => void;
  setMinimap: (enabled: boolean) => void;
  setLineNumbers: (enabled: boolean) => void;
  saveContent: () => Promise<void>;
  resetToDefaults: () => void;
}

const DEFAULT_CONFIG: CodeEditorConfig = {
  language: 'javascript',
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  autoCloseBrackets: true,
  autoIndent: true,
  readOnly: false,
};

/**
 * Hook for managing code editor state
 */
export function useCodeEditor(options: UseCodeEditorOptions = {}): UseCodeEditorReturn {
  const { file, projectPath, onSave, readOnly = false } = options;

  // Content state
  const [content, setContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Configuration state
  const [language, setLanguageState] = useState<EditorLanguage>('javascript');
  const [theme, setThemeState] = useState<EditorTheme>('dark');
  const [wordWrap, setWordWrapState] = useState<boolean>(true);
  const [minimap, setMinimapState] = useState<boolean>(true);
  const [lineNumbers, setLineNumbersState] = useState<boolean>(true);
  const [fontSize, setFontSizeState] = useState<number>(14);

  // Refs for timeouts
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Load settings from localStorage
   */
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('codeEditorTheme');
      const savedWordWrap = localStorage.getItem('codeEditorWordWrap');
      const savedMinimap = localStorage.getItem('codeEditorShowMinimap');
      const savedLineNumbers = localStorage.getItem('codeEditorLineNumbers');
      const savedFontSize = localStorage.getItem('codeEditorFontSize');

      if (savedTheme && ['light', 'dark', 'monokai', 'solarized', 'dracula', 'nord', 'github'].includes(savedTheme)) {
        setThemeState(savedTheme as EditorTheme);
      }
      if (savedWordWrap) {
        setWordWrapState(savedWordWrap === 'true');
      }
      if (savedMinimap) {
        setMinimapState(savedMinimap !== 'false');
      }
      if (savedLineNumbers) {
        setLineNumbersState(savedLineNumbers !== 'false');
      }
      if (savedFontSize) {
        const size = parseInt(savedFontSize, 10);
        if (!isNaN(size) && size >= 8 && size <= 32) {
          setFontSizeState(size);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  /**
   * Auto-reset save success indicator
   */
  useEffect(() => {
    if (saveSuccess) {
      saveSuccessTimeoutRef.current = setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    }

    return () => {
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, [saveSuccess]);

  /**
   * Get current configuration
   */
  const config: CodeEditorConfig = {
    language,
    theme,
    fontSize,
    tabSize: 2,
    wordWrap,
    lineNumbers,
    minimap,
    autoCloseBrackets: true,
    autoIndent: true,
    readOnly,
  };

  /**
   * Update configuration
   */
  const updateConfig = useCallback((updates: Partial<CodeEditorConfig>) => {
    if (updates.theme !== undefined) {
      setTheme(updates.theme);
      try {
        localStorage.setItem('codeEditorTheme', updates.theme);
      } catch {}
    }
    if (updates.wordWrap !== undefined) {
      setWordWrapState(updates.wordWrap);
      try {
        localStorage.setItem('codeEditorWordWrap', String(updates.wordWrap));
      } catch {}
    }
    if (updates.minimap !== undefined) {
      setMinimapState(updates.minimap);
      try {
        localStorage.setItem('codeEditorShowMinimap', String(updates.minimap));
      } catch {}
    }
    if (updates.lineNumbers !== undefined) {
      setLineNumbersState(updates.lineNumbers);
      try {
        localStorage.setItem('codeEditorLineNumbers', String(updates.lineNumbers));
      } catch {}
    }
    if (updates.fontSize !== undefined) {
      setFontSizeState(updates.fontSize);
      try {
        localStorage.setItem('codeEditorFontSize', String(updates.fontSize));
      } catch {}
    }
    if (updates.language !== undefined) {
      setLanguageState(updates.language);
    }
  }, []);

  /**
   * Set theme
   */
  const setTheme = useCallback((newTheme: EditorTheme) => {
    updateConfig({ theme: newTheme });
  }, [updateConfig]);

  /**
   * Set language
   */
  const setLanguage = useCallback((newLanguage: EditorLanguage) => {
    updateConfig({ language: newLanguage });
  }, [updateConfig]);

  /**
   * Set font size
   */
  const setFontSize = useCallback((size: number) => {
    updateConfig({ fontSize: size });
  }, [updateConfig]);

  /**
   * Set word wrap
   */
  const setWordWrap = useCallback((enabled: boolean) => {
    updateConfig({ wordWrap: enabled });
  }, [updateConfig]);

  /**
   * Set minimap
   */
  const setMinimap = useCallback((enabled: boolean) => {
    updateConfig({ minimap: enabled });
  }, [updateConfig]);

  /**
   * Set line numbers
   */
  const setLineNumbers = useCallback((enabled: boolean) => {
    updateConfig({ lineNumbers: enabled });
  }, [updateConfig]);

  /**
   * Save content
   */
  const saveContent = useCallback(async () => {
    if (!onSave || !file) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(content);
      setSaveSuccess(true);
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave, file]);

  /**
   * Reset to defaults
   */
  const resetToDefaults = useCallback(() => {
    setThemeState('dark');
    setWordWrapState(true);
    setMinimapState(true);
    setLineNumbersState(true);
    setFontSizeState(14);

    // Clear localStorage
    try {
      localStorage.removeItem('codeEditorTheme');
      localStorage.removeItem('codeEditorWordWrap');
      localStorage.removeItem('codeEditorShowMinimap');
      localStorage.removeItem('codeEditorLineNumbers');
      localStorage.removeItem('codeEditorFontSize');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return {
    config,
    content,
    language,
    theme,
    wordWrap,
    minimap,
    lineNumbers,
    fontSize,
    isSaving,
    saveSuccess,
    updateConfig,
    setTheme,
    setLanguage,
    setFontSize,
    setWordWrap,
    setMinimap,
    setLineNumbers,
    saveContent,
    resetToDefaults,
  };
}

/**
 * Hook for language detection
 */
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
