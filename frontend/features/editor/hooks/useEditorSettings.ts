import { useState, useEffect } from 'react';

/**
 * Hook 返回值接口：包含编辑器设置状态和设置函数
 */
interface UseEditorSettingsReturn {
    isDarkMode: boolean;                          // 是否暗色模式
    setIsDarkMode: (dark: boolean) => void;       // 设置暗色模式
    wordWrap: boolean;                            // 是否自动换行
    setWordWrap: (wrap: boolean) => void;         // 设置自动换行
    minimapEnabled: boolean;                      // 是否启用 minimap
    setMinimapEnabled: (enabled: boolean) => void;  // 设置 minimap
    showLineNumbers: boolean;                     // 是否显示行号
    setShowLineNumbers: (show: boolean) => void;   // 设置行号显示
    fontSize: string;                             // 字体大小
    setFontSize: (size: string) => void;          // 设置字体大小
}

/**
 * 从 localStorage 读取字符串值，不存在则返回默认值
 * @param key - localStorage 键名
 * @param fallback - 默认值
 * @returns 读取的值或默认值
 */
function initFromStorage(key: string, fallback: string): string {
    return localStorage.getItem(key) || fallback;
}

/**
 * 从 localStorage 读取布尔值，不存在则返回默认值
 * @param key - localStorage 键名
 * @param fallback - 默认值
 * @returns 读取的值转换为布尔，或默认值
 */
function initBoolFromStorage(key: string, fallback: boolean): boolean {
    const val = localStorage.getItem(key);
    return val !== null ? val === 'true' : fallback;
}

/**
 * 编辑器设置 Hook：管理暗色模式、自动换行、minimap、行号、字号等偏好，持久化到 localStorage 并监听跨标签页同步
 * 支持 Settings 模块的全局设置同步
 */
export function useEditorSettings(): UseEditorSettingsReturn {
    // 暗色模式：从 localStorage 读取，默认为 true
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('codeEditorTheme');
        return saved ? saved === 'dark' : true;
    });
    // 自动换行：默认为 false
    const [wordWrap, setWordWrap] = useState<boolean>(() => initBoolFromStorage('codeEditorWordWrap', false));
    // Minimap：默认为启用（只有显式设置为 'false' 才禁用）
    const [minimapEnabled, setMinimapEnabled] = useState<boolean>(() => {
        return localStorage.getItem('codeEditorShowMinimap') !== 'false';
    });
    // 行号：默认为启用（只有显式设置为 'false' 才禁用）
    const [showLineNumbers, setShowLineNumbers] = useState<boolean>(() => {
        return localStorage.getItem('codeEditorLineNumbers') !== 'false';
    });
    // 字号：默认为 14px
    const [fontSize, setFontSize] = useState<string>(() => initFromStorage('codeEditorFontSize', '14'));

    // 持久化暗色模式设置到 localStorage
    useEffect(() => {
        localStorage.setItem('codeEditorTheme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    // 持久化自动换行设置到 localStorage
    useEffect(() => {
        localStorage.setItem('codeEditorWordWrap', wordWrap.toString());
    }, [wordWrap]);

    // 监听 Settings 模块的全局设置变更和跨标签页同步
    useEffect(() => {
        const sync = () => {
            // 同步主题设置
            const theme = localStorage.getItem('codeEditorTheme');
            if (theme) setIsDarkMode(theme === 'dark');

            // 同步自动换行设置
            const wrap = localStorage.getItem('codeEditorWordWrap');
            if (wrap !== null) setWordWrap(wrap === 'true');

            // 同步 minimap 设置
            const minimap = localStorage.getItem('codeEditorShowMinimap');
            if (minimap !== null) setMinimapEnabled(minimap !== 'false');

            // 同步行号设置
            const lines = localStorage.getItem('codeEditorLineNumbers');
            if (lines !== null) setShowLineNumbers(lines !== 'false');

            // 同步字号设置
            const size = localStorage.getItem('codeEditorFontSize');
            if (size) setFontSize(size);
        };

        // 监听 storage 事件（跨标签页）和自定义事件（Settings 模块）
        window.addEventListener('storage', sync);
        window.addEventListener('codeEditorSettingsChanged', sync);

        return () => {
            window.removeEventListener('storage', sync);
            window.removeEventListener('codeEditorSettingsChanged', sync);
        };
    }, []);

    return {
        isDarkMode,
        setIsDarkMode,
        wordWrap,
        setWordWrap,
        minimapEnabled,
        setMinimapEnabled,
        showLineNumbers,
        setShowLineNumbers,
        fontSize,
        setFontSize
    };
}
