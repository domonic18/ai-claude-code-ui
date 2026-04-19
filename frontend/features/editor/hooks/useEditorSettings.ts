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

/** Initialize state from localStorage with fallback */
function initFromStorage(key: string, fallback: string): string {
    return localStorage.getItem(key) || fallback;
}

function initBoolFromStorage(key: string, fallback: boolean): boolean {
    const val = localStorage.getItem(key);
    return val !== null ? val === 'true' : fallback;
}

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
