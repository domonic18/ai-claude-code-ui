/**
 * useCodeEditorSettings Hook
 *
 * Custom hook for managing code editor appearance settings.
 * Handles theme, word wrap, minimap, line numbers, and font size.
 */

import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS, DEFAULTS } from '../constants/settings.constants';

export interface CodeEditorSettings {
  theme: string;
  wordWrap: boolean;
  showMinimap: boolean;
  lineNumbers: boolean;
  fontSize: number;
}

export interface UseCodeEditorSettingsReturn {
  settings: CodeEditorSettings;
  setTheme: (theme: string) => void;
  setWordWrap: (enabled: boolean) => void;
  setShowMinimap: (show: boolean) => void;
  setLineNumbers: (show: boolean) => void;
  setFontSize: (size: number) => void;
  resetToDefaults: () => void;
}

/**
 * Load setting from localStorage
 */
function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Save setting to localStorage
 */
function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[useCodeEditorSettings] Error saving to localStorage (${key}):`, error);
  }
}

/**
 * Custom hook for code editor settings management
 */
export function useCodeEditorSettings(): UseCodeEditorSettingsReturn {
  const [theme, setThemeState] = useState<string>(() =>
    loadFromLocalStorage(STORAGE_KEYS.CODE_EDITOR_THEME, DEFAULTS.CODE_EDITOR.theme)
  );

  const [wordWrap, setWordWrapState] = useState<boolean>(() =>
    loadFromLocalStorage(STORAGE_KEYS.CODE_EDITOR_WORD_WRAP, DEFAULTS.CODE_EDITOR.wordWrap)
  );

  const [showMinimap, setShowMinimapState] = useState<boolean>(() =>
    loadFromLocalStorage(STORAGE_KEYS.CODE_EDITOR_SHOW_MINIMAP, DEFAULTS.CODE_EDITOR.showMinimap)
  );

  const [lineNumbers, setLineNumbersState] = useState<boolean>(() =>
    loadFromLocalStorage(STORAGE_KEYS.CODE_EDITOR_LINE_NUMBERS, DEFAULTS.CODE_EDITOR.lineNumbers)
  );

  const [fontSize, setFontSizeState] = useState<number>(() =>
    loadFromLocalStorage(STORAGE_KEYS.CODE_EDITOR_FONT_SIZE, DEFAULTS.CODE_EDITOR.fontSize)
  );

  /**
   * Set theme and persist to localStorage
   */
  const setTheme = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    saveToLocalStorage(STORAGE_KEYS.CODE_EDITOR_THEME, newTheme);
  }, []);

  /**
   * Set word wrap and persist to localStorage
   */
  const setWordWrap = useCallback((enabled: boolean) => {
    setWordWrapState(enabled);
    saveToLocalStorage(STORAGE_KEYS.CODE_EDITOR_WORD_WRAP, enabled);
  }, []);

  /**
   * Set show minimap and persist to localStorage
   */
  const setShowMinimap = useCallback((show: boolean) => {
    setShowMinimapState(show);
    saveToLocalStorage(STORAGE_KEYS.CODE_EDITOR_SHOW_MINIMAP, show);
  }, []);

  /**
   * Set line numbers and persist to localStorage
   */
  const setLineNumbers = useCallback((show: boolean) => {
    setLineNumbersState(show);
    saveToLocalStorage(STORAGE_KEYS.CODE_EDITOR_LINE_NUMBERS, show);
  }, []);

  /**
   * Set font size and persist to localStorage
   */
  const setFontSize = useCallback((size: number) => {
    setFontSizeState(size);
    saveToLocalStorage(STORAGE_KEYS.CODE_EDITOR_FONT_SIZE, size);
  }, []);

  /**
   * Reset all settings to defaults
   */
  const resetToDefaults = useCallback(() => {
    const defaults = DEFAULTS.CODE_EDITOR;

    setThemeState(defaults.theme);
    setWordWrapState(defaults.wordWrap);
    setShowMinimapState(defaults.showMinimap);
    setLineNumbersState(defaults.lineNumbers);
    setFontSizeState(defaults.fontSize);

    Object.entries(defaults).forEach(([key, value]) => {
      const storageKey = (STORAGE_KEYS as Record<string, string>)[`CODE_EDITOR_${key.toUpperCase()}`];
      if (storageKey) {
        saveToLocalStorage(storageKey, value);
      }
    });
  }, []);

  return {
    settings: {
      theme,
      wordWrap,
      showMinimap,
      lineNumbers,
      fontSize,
    },
    setTheme,
    setWordWrap,
    setShowMinimap,
    setLineNumbers,
    setFontSize,
    resetToDefaults,
  };
}

export default useCodeEditorSettings;
