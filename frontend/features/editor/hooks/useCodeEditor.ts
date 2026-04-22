/**
 * Code Editor Hooks
 *
 * Custom hooks for code editor functionality.
 * 提供编辑器配置管理、保存操作、语言检测等核心功能
 */

// React Hooks：状态管理、回调函数、副作用、引用
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

// 编辑器 Hook 选项：文件、项目路径、保存回调、只读模式
export interface UseCodeEditorOptions {
  file?: EditorFile;
  projectPath?: string;
  onSave?: (content: string) => Promise<void>;
  readOnly?: boolean;
}

// 编辑器 Hook 返回值：配置、内容、状态、操作函数
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

// 管理编辑器保存状态和操作的 Hook
/**
 * Hook for managing editor save state and operations
 */
function useEditorSave(
  onSave: ((content: string) => Promise<void>) | undefined,
  file: EditorFile | undefined,
  content: string
) {
  // 保存状态：保存中、保存成功
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // 保存成功提示 2 秒后自动清除
  // 使用防抖机制，避免状态频繁切换
  useEffect(() => {
    if (saveSuccess) {
      saveSuccessTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000);
    }
    // 清理函数：组件卸载或状态变更时取消定时器
    return () => {
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, [saveSuccess]);

  // 保存内容函数：调用 onSave 回调并更新状态
  // 仅在有保存回调且有文件对象时才执行保存操作
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
      // 无论成功失败都重置保存中状态
      setIsSaving(false);
    }
  }, [content, onSave, file]);

  return { isSaving, saveSuccess, saveContent };
}

// 管理编辑器配置和设置函数的 Hook
/**
 * Hook for managing editor configuration and setters
 */
function useEditorConfig(readOnly: boolean) {
  // 编辑器配置状态：语言、主题、自动换行、minimap、行号、字号
  // 默认值参考 DEFAULT_EDITOR_CONFIG 常量
  const [language, setLanguageState] = useState<EditorLanguage>('javascript');
  const [theme, setThemeState] = useState<EditorTheme>('dark');
  const [wordWrap, setWordWrapState] = useState<boolean>(true);
  const [minimap, setMinimapState] = useState<boolean>(true);
  const [lineNumbers, setLineNumbersState] = useState<boolean>(true);
  const [fontSize, setFontSizeState] = useState<number>(14);

  // 组件挂载时从 localStorage 加载设置
  // 只在首次渲染时执行，避免后续覆盖用户更改
  useEffect(() => {
    loadSettingsFromStorage(setThemeState, setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState);
  }, [setThemeState, setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState]);

  // 使用 ref 解决循环依赖问题：updateConfig 需要引用 setTheme
  // 如果直接在 updateConfig 中使用 setThemeState，会导致依赖循环
  const setThemeRef = useRef<(theme: EditorTheme) => void>();
  const updateConfig = useCallback((updates: Partial<CodeEditorConfig>) => {
    const setThemeFn = setThemeRef.current;
    if (!setThemeFn) return;
    updateConfigAndPersist(updates, setThemeFn, setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState, setLanguageState);
  }, [setWordWrapState, setMinimapState, setLineNumbersState, setFontSizeState, setLanguageState]);

  // 将 setTheme 同步到 ref，供 updateConfig 使用
  // 每次 setThemeState 变化时更新 ref，确保 ref 指向最新的函数
  useEffect(() => {
    setThemeRef.current = setThemeState;
  }, [setThemeState]);

  // 创建配置更新函数：每个函数都通过 updateConfig 统一处理
  // 这种设计模式确保所有配置变更都经过相同的持久化逻辑
  const setTheme = useCallback((t: EditorTheme) => updateConfig({ theme: t }), [updateConfig]);
  const setLanguage = useCallback((l: EditorLanguage) => updateConfig({ language: l }), [updateConfig]);
  const setFontSize = useCallback((s: number) => updateConfig({ fontSize: s }), [updateConfig]);
  const setWordWrap = useCallback((w: boolean) => updateConfig({ wordWrap: w }), [updateConfig]);
  const setMinimap = useCallback((m: boolean) => updateConfig({ minimap: m }), [updateConfig]);
  const setLineNumbers = useCallback((l: boolean) => updateConfig({ lineNumbers: l }), [updateConfig]);

  // 组装配置对象，供 CodeMirror 使用
  const config: CodeEditorConfig = {
    language, theme, fontSize, tabSize: 2, wordWrap, lineNumbers, minimap,
    autoCloseBrackets: true, autoIndent: true, readOnly,
  };

  // 重置为默认配置：恢复所有设置到初始值并清除 localStorage
  // 用户点击"重置"按钮时调用此函数
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

// 主 Hook：组合配置和保存功能，提供完整的编辑器状态管理
// CodeEditor 组件使用此 hook 管理 CodeMirror 实例和编辑器状态
/**
 * Hook for managing code editor state
 */
export function useCodeEditor(options: UseCodeEditorOptions = {}): UseCodeEditorReturn {
  const { file, projectPath, onSave, readOnly = false } = options;

  // 初始化内容状态
  const [content, setContent] = useState<string>('');

  // 管理编辑器配置和设置函数
  const configState = useEditorConfig(readOnly);

  // 管理保存操作
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
