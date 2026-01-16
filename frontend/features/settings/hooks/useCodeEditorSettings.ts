/**
 * useCodeEditorSettings Hook
 *
 * Custom hook for managing code editor appearance settings.
 * Matches the exact implementation from original Settings.jsx.
 *
 * Triggers 'codeEditorSettingsChanged' event on settings change
 * to notify CodeEditor component to reload from localStorage.
 */

import { useState, useCallback } from 'react';

export interface CodeEditorSettings {
  theme: string;
  wordWrap: boolean;
  showMinimap: boolean;
  lineNumbers: boolean;
  fontSize: string;
}

export interface UseCodeEditorSettingsReturn {
  settings: CodeEditorSettings;
  setCodeEditorTheme: (theme: string) => void;
  setCodeEditorWordWrap: (enabled: boolean) => void;
  setCodeEditorShowMinimap: (show: boolean) => void;
  setCodeEditorLineNumbers: (show: boolean) => void;
  setCodeEditorFontSize: (size: string) => void;
}

/**
 * Trigger codeEditorSettingsChanged event to notify CodeEditor component
 */
function triggerSettingsChangedEvent() {
  window.dispatchEvent(new Event('codeEditorSettingsChanged'));
}

/**
 * Custom hook for code editor settings management
 * Matches original Settings.jsx implementation exactly
 */
export function useCodeEditorSettings(): UseCodeEditorSettingsReturn {
  // Code Editor Theme - use 'dark' or 'light' to match CodeEditor.jsx expectations
  const [theme, setCodeEditorThemeState] = useState<string>(() =>
    localStorage.getItem('codeEditorTheme') || 'dark'
  );

  // Word Wrap - check for string 'true' like original
  const [wordWrap, setCodeEditorWordWrapState] = useState<boolean>(() =>
    localStorage.getItem('codeEditorWordWrap') === 'true'
  );

  // Show Minimap - default true, only false if explicitly 'false'
  const [showMinimap, setCodeEditorShowMinimapState] = useState<boolean>(() =>
    localStorage.getItem('codeEditorShowMinimap') !== 'false'
  );

  // Line Numbers - default true, only false if explicitly 'false'
  const [lineNumbers, setCodeEditorLineNumbersState] = useState<boolean>(() =>
    localStorage.getItem('codeEditorLineNumbers') !== 'false'
  );

  // Font Size - use string directly like original
  const [fontSize, setCodeEditorFontSizeState] = useState<string>(() =>
    localStorage.getItem('codeEditorFontSize') || '14'
  );

  /**
   * Set theme and persist to localStorage
   */
  const setCodeEditorTheme = useCallback((newTheme: string) => {
    setCodeEditorThemeState(newTheme);
    localStorage.setItem('codeEditorTheme', newTheme);
    triggerSettingsChangedEvent();
  }, []);

  /**
   * Set word wrap and persist to localStorage
   */
  const setCodeEditorWordWrap = useCallback((enabled: boolean) => {
    setCodeEditorWordWrapState(enabled);
    localStorage.setItem('codeEditorWordWrap', enabled ? 'true' : 'false');
    triggerSettingsChangedEvent();
  }, []);

  /**
   * Set show minimap and persist to localStorage
   */
  const setCodeEditorShowMinimap = useCallback((show: boolean) => {
    setCodeEditorShowMinimapState(show);
    localStorage.setItem('codeEditorShowMinimap', show ? 'true' : 'false');
    triggerSettingsChangedEvent();
  }, []);

  /**
   * Set line numbers and persist to localStorage
   */
  const setCodeEditorLineNumbers = useCallback((show: boolean) => {
    setCodeEditorLineNumbersState(show);
    localStorage.setItem('codeEditorLineNumbers', show ? 'true' : 'false');
    triggerSettingsChangedEvent();
  }, []);

  /**
   * Set font size and persist to localStorage
   */
  const setCodeEditorFontSize = useCallback((size: string) => {
    setCodeEditorFontSizeState(size);
    localStorage.setItem('codeEditorFontSize', size);
    triggerSettingsChangedEvent();
  }, []);

  return {
    settings: {
      theme,
      wordWrap,
      showMinimap,
      lineNumbers,
      fontSize,
    },
    setCodeEditorTheme,
    setCodeEditorWordWrap,
    setCodeEditorShowMinimap,
    setCodeEditorLineNumbers,
    setCodeEditorFontSize,
  };
}

export default useCodeEditorSettings;
