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
import { logger } from '@/shared/utils/logger';

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

// ============================================================================
// Module-level helpers for localStorage persistence
// ============================================================================

function loadSettingsFromStorage(
  setThemeState: (theme: EditorTheme) => void,
  setWordWrapState: (enabled: boolean) => void,
  setMinimapState: (enabled: boolean) => void,
  setLineNumbersState: (enabled: boolean) => void,
  setFontSizeState: (size: number) => void
): void {
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
}

function updateConfigAndPersist(
  updates: Partial<CodeEditorConfig>,
  setTheme: (theme: EditorTheme) => void,
  setWordWrapState: (enabled: boolean) => void,
  setMinimapState: (enabled: boolean) => void,
  setLineNumbersState: (enabled: boolean) => void,
  setFontSizeState: (size: number) => void,
  setLanguageState: (language: EditorLanguage) => void
): void {
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
}

function clearEditorSettingsFromStorage(): void {
  try {
    localStorage.removeItem('codeEditorTheme');
    localStorage.removeItem('codeEditorWordWrap');
    localStorage.removeItem('codeEditorShowMinimap');
    localStorage.removeItem('codeEditorLineNumbers');
    localStorage.removeItem('codeEditorFontSize');
  } catch {
    // Ignore localStorage errors
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for managing editor save state and operations
 */
function useEditorSave(
  onSave: ((content: string) => Promise<void>) | undefined,
  file: EditorFile | undefined,
  content: string
) {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (saveSuccess) {
      saveSuccessTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
    }
    return () => {
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, [saveSuccess]);

  const saveContent = useCallback(async () => {
    if (!onSave || !file) return;

    setIsSaving(true);
    try {
      await onSave(content);
      setSaveSuccess(true);
    } catch (error) {
      logger.error('Failed to save file:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave, file]);

  return { isSaving, saveSuccess, saveContent };
}

/**
 * Hook for managing editor configuration and setters
 */
function useEditorConfig(readOnly: boolean) {
  const [language, setLanguageState] = useState<EditorLanguage>('javascript');
  const [theme, setThemeState] = useState<EditorTheme>('dark');
  const [wordWrap, setWordWrapState] = useState<boolean>(true);
  const [minimap, setMinimapState] = useState<boolean>(true);
  const [lineNumbers, setLineNumbersState] = useState<boolean>(true);
  const [fontSize, setFontSizeState] = useState<number>(14);

  // Load settings from localStorage on mount
  useEffect(() => {
    loadSettingsFromStorage(setThemeState, setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState);
  }, [setThemeState, setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState]);

  // Create updateConfig with circular dependency workaround
  const setThemeRef = useRef<(theme: EditorTheme) => void>();
  const updateConfig = useCallback((updates: Partial<CodeEditorConfig>) => {
    const setThemeFn = setThemeRef.current;
    if (!setThemeFn) return;
    updateConfigAndPersist(updates, setThemeFn, setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState, setLanguageState);
  }, [setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState, setLanguageState]);

  // Sync setTheme to ref
  useEffect(() => {
    setThemeRef.current = setThemeState;
  }, [setThemeState]);

  // Create setter functions
  const setTheme = useCallback((t: EditorTheme) => updateConfig({ theme: t }), [updateConfig]);
  const setLanguage = useCallback((l: EditorLanguage) => updateConfig({ language: l }), [updateConfig]);
  const setFontSize = useCallback((s: number) => updateConfig({ fontSize: s }), [updateConfig]);
  const setWordWrap = useCallback((w: boolean) => updateConfig({ wordWrap: w }), [updateConfig]);
  const setMinimap = useCallback((m: boolean) => updateConfig({ minimap: m }), [updateConfig]);
  const setLineNumbers = useCallback((l: boolean) => updateConfig({ lineNumbers: l }), [updateConfig]);

  // Create config object
  const config: CodeEditorConfig = {
    language, theme, fontSize, tabSize: 2, wordWrap, lineNumbers, minimap,
    autoCloseBrackets: true, autoIndent: true, readOnly,
  };

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setThemeState('dark');
    setWordWrapState(true);
    setMinimapState(true);
    setLineNumbersState(true);
    setFontSizeState(14);
    clearEditorSettingsFromStorage();
  }, [setThemeState, setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState]);

  return {
    config, language, theme, wordWrap, minimap, lineNumbers, fontSize,
    updateConfig, setTheme, setLanguage, setFontSize, setWordWrap, setMinimap, setLineNumbers,
    resetToDefaults,
  };
}

/**
 * Hook for managing code editor state
 */
export function useCodeEditor(options: UseCodeEditorOptions = {}): UseCodeEditorReturn {
  const { file, projectPath, onSave, readOnly = false } = options;

  // Initialize content state
  const [content, setContent] = useState<string>('');

  // Manage configuration and setters
  const configState = useEditorConfig(readOnly);

  // Manage save operations
  const { isSaving, saveSuccess, saveContent } = useEditorSave(onSave, file, content);

  return {
    ...configState,
    content,
    isSaving,
    saveSuccess,
    saveContent,
  };
}

// Re-export language detection hook
export { useLanguageDetection } from './useLanguageDetection';
export type { UseLanguageDetectionReturn } from './useLanguageDetection';
