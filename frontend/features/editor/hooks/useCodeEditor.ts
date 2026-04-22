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
import {
  loadSettingsFromStorage,
  updateConfigAndPersist,
  clearEditorSettingsFromStorage,
} from './editorStorageHelpers';

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

// CodeEditor 组件使用此 hook 管理 CodeMirror 实例和编辑器状态
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
