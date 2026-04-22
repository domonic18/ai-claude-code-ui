/**
 * Editor Storage Helpers
 *
 * Module-level helpers for localStorage persistence in code editor.
 *
 * @module features/editor/hooks/editorStorageHelpers
 */

// 导入编辑器配置类型：语言、主题等
import type {
  CodeEditorConfig,
  EditorLanguage,
  EditorTheme,
} from '../types';

/**
 * 从 localStorage 加载编辑器设置并更新状态
 * 读取并验证主题、自动换行、minimap、行号、字号等设置
 *
 * @param setThemeState - 主题状态设置函数
 * @param setWordWrapState - 自动换行状态设置函数
 * @param setMinimapState - Minimap 状态设置函数
 * @param setLineNumbersState - 行号状态设置函数
 * @param setFontSizeState - 字号状态设置函数
 */
export function loadSettingsFromStorage(
  setThemeState: (theme: EditorTheme) => void,
  setWordWrapState: (enabled: boolean) => void,
  setMinimapState: (enabled: boolean) => void,
  setLineNumbersState: (enabled: boolean) => void,
  setFontSizeState: (size: number) => void
): void {
  try {
    // 从 localStorage 读取各设置的值
    const savedTheme = localStorage.getItem('codeEditorTheme');
    const savedWordWrap = localStorage.getItem('codeEditorWordWrap');
    const savedMinimap = localStorage.getItem('codeEditorShowMinimap');
    const savedLineNumbers = localStorage.getItem('codeEditorLineNumbers');
    const savedFontSize = localStorage.getItem('codeEditorFontSize');

    // 验证主题值是否在允许的列表中
    if (savedTheme && ['light', 'dark', 'monokai', 'solarized', 'dracula', 'nord', 'github'].includes(savedTheme)) {
      setThemeState(savedTheme as EditorTheme);
    }
    // 布尔值转换：字符串 'true'/'false' 转为布尔值
    if (savedWordWrap) {
      setWordWrapState(savedWordWrap === 'true');
    }
    // Minimap 默认启用，只有显式设置为 'false' 才禁用
    if (savedMinimap) {
      setMinimapState(savedMinimap !== 'false');
    }
    // 行号默认启用，只有显式设置为 'false' 才禁用
    if (savedLineNumbers) {
      setLineNumbersState(savedLineNumbers !== 'false');
    }
    // 字号验证：必须在 8-32 之间的有效数字
    if (savedFontSize) {
      const size = parseInt(savedFontSize, 10);
      if (!isNaN(size) && size >= 8 && size <= 32) {
        setFontSizeState(size);
      }
    }
  } catch {
    // 忽略 localStorage 错误（如隐私模式下禁用）
  }
}

/**
 * 更新编辑器配置并持久化到 localStorage
 * 同时更新 React 状态和 localStorage 存储
 *
 * @param updates - 配置更新对象（部分配置）
 * @param setTheme - 主题设置函数
 * @param setWordWrapState - 自动换行设置函数
 * @param setMinimapState - Minimap 设置函数
 * @param setLineNumbersState - 行号设置函数
 * @param setFontSizeState - 字号设置函数
 * @param setLanguageState - 语言设置函数
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
  // 更新主题配置
  if (updates.theme !== undefined) {
    setTheme(updates.theme);
    try {
      localStorage.setItem('codeEditorTheme', updates.theme);
    } catch {
      // 忽略 localStorage 错误
    }
  }
  // 更新自动换行配置
  if (updates.wordWrap !== undefined) {
    setWordWrapState(updates.wordWrap);
    try {
      localStorage.setItem('codeEditorWordWrap', String(updates.wordWrap));
    } catch {}
  }
  // 更新 Minimap 配置
  if (updates.minimap !== undefined) {
    setMinimapState(updates.minimap);
    try {
      localStorage.setItem('codeEditorShowMinimap', String(updates.minimap));
    } catch {}
  }
  // 更新行号配置
  if (updates.lineNumbers !== undefined) {
    setLineNumbersState(updates.lineNumbers);
    try {
      localStorage.setItem('codeEditorLineNumbers', String(updates.lineNumbers));
    } catch {}
  }
  // 更新字号配置
  if (updates.fontSize !== undefined) {
    setFontSizeState(updates.fontSize);
    try {
      localStorage.setItem('codeEditorFontSize', String(updates.fontSize));
    } catch {}
  }
  // 更新语言配置（仅更新状态，不持久化）
  if (updates.language !== undefined) {
    setLanguageState(updates.language);
  }
}

/**
 * 清除 localStorage 中的所有编辑器设置
 * 用于重置编辑器配置或用户登出时清理数据
 */
export function clearEditorSettingsFromStorage(): void {
  try {
    localStorage.removeItem('codeEditorTheme');
    localStorage.removeItem('codeEditorWordWrap');
    localStorage.removeItem('codeEditorShowMinimap');
    localStorage.removeItem('codeEditorLineNumbers');
    localStorage.removeItem('codeEditorFontSize');
  } catch {
    // 忽略 localStorage 错误（如隐私模式下禁用）
  }
}
