/**
 * Editor Storage Helpers
 *
 * Module-level helpers for localStorage persistence in code editor.
 *
 * @module features/editor/hooks/editorStorageHelpers
 */

import type {
  CodeEditorConfig,
  EditorLanguage,
  EditorTheme,
} from '../types';

/**
 * Load editor settings from localStorage
 *
 * @param setThemeState - Theme state setter
 * @param setWordWrapState - Word wrap state setter
 * @param setMinimapState - Minimap state setter
 * @param setLineNumbersState - Line numbers state setter
 * @param setFontSizeState - Font size state setter
 */
export function loadSettingsFromStorage(
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

/**
 * Update editor config and persist to localStorage
 *
 * @param updates - Config updates
 * @param setTheme - Theme setter
 * @param setWordWrapState - Word wrap state setter
 * @param setMinimapState - Minimap state setter
 * @param setLineNumbersState - Line numbers state setter
 * @param setFontSizeState - Font size state setter
 * @param setLanguageState - Language state setter
 */
export function updateConfigAndPersist(
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

/**
 * Clear all editor settings from localStorage
 */
export function clearEditorSettingsFromStorage(): void {
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
