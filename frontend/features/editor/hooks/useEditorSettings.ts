import { useState, useEffect } from 'react';

interface UseEditorSettingsReturn {
    isDarkMode: boolean;
    setIsDarkMode: (dark: boolean) => void;
    wordWrap: boolean;
    setWordWrap: (wrap: boolean) => void;
    minimapEnabled: boolean;
    setMinimapEnabled: (enabled: boolean) => void;
    showLineNumbers: boolean;
    setShowLineNumbers: (show: boolean) => void;
    fontSize: string;
    setFontSize: (size: string) => void;
}

/**
 * 从 localStorage 读取字符串值，不存在则返回默认值
 */
function initFromStorage(key: string, fallback: string): string {
    return localStorage.getItem(key) || fallback;
}

/**
 * 从 localStorage 读取布尔值，不存在则返回默认值
 */
function initBoolFromStorage(key: string, fallback: boolean): boolean {
    const val = localStorage.getItem(key);
    return val !== null ? val === 'true' : fallback;
}

/**
 * 编辑器设置 Hook：管理暗色模式、自动换行、minimap、行号、字号等偏好，持久化到 localStorage 并监听跨标签页同步
 */
export function useEditorSettings(): UseEditorSettingsReturn {
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('codeEditorTheme');
        return saved ? saved === 'dark' : true;
    });
    const [wordWrap, setWordWrap] = useState<boolean>(() => initBoolFromStorage('codeEditorWordWrap', false));
    const [minimapEnabled, setMinimapEnabled] = useState<boolean>(() => {
        return localStorage.getItem('codeEditorShowMinimap') !== 'false';
    });
    const [showLineNumbers, setShowLineNumbers] = useState<boolean>(() => {
        return localStorage.getItem('codeEditorLineNumbers') !== 'false';
    });
    const [fontSize, setFontSize] = useState<string>(() => initFromStorage('codeEditorFontSize', '14'));

    // Persist settings to localStorage
    useEffect(() => {
        localStorage.setItem('codeEditorTheme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    useEffect(() => {
        localStorage.setItem('codeEditorWordWrap', wordWrap.toString());
    }, [wordWrap]);

    // Listen for settings changes from the Settings modal
    useEffect(() => {
        const sync = () => {
            const theme = localStorage.getItem('codeEditorTheme');
            if (theme) setIsDarkMode(theme === 'dark');

            const wrap = localStorage.getItem('codeEditorWordWrap');
            if (wrap !== null) setWordWrap(wrap === 'true');

            const minimap = localStorage.getItem('codeEditorShowMinimap');
            if (minimap !== null) setMinimapEnabled(minimap !== 'false');

            const lines = localStorage.getItem('codeEditorLineNumbers');
            if (lines !== null) setShowLineNumbers(lines !== 'false');

            const size = localStorage.getItem('codeEditorFontSize');
            if (size) setFontSize(size);
        };

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
