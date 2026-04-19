import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';
import type { EditorFile } from '../types/editor.types';

interface UseCodeEditorStateProps {
    file: EditorFile;
    projectPath: string;
    onClose: () => void;
}

interface UseCodeEditorStateReturn {
    // State
    content: string;
    loading: boolean;
    saving: boolean;
    isFullscreen: boolean;
    isDarkMode: boolean;
    saveSuccess: boolean;
    showDiff: boolean;
    wordWrap: boolean;
    minimapEnabled: boolean;
    showLineNumbers: boolean;
    fontSize: string;
    previewMode: 'edit' | 'preview' | 'split';
    editorRef: React.RefObject<any>;

    // Setters
    setContent: (content: string) => void;
    setIsFullscreen: (fullscreen: boolean) => void;
    setPreviewMode: (mode: 'edit' | 'preview' | 'split') => void;
    setShowDiff: (show: boolean) => void;

    // Actions
    handleSave: () => Promise<void>;
    handleDownload: () => void;
    handleToggleDiff: () => void;
}

// Binary file extensions that should not be displayed as text
const BINARY_EXTENSIONS = [
    '.docx', '.pdf', '.xlsx', '.pptx', '.zip',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.mp3', '.mp4'
];

export function useCodeEditorState({
    file,
    projectPath,
    onClose
}: UseCodeEditorStateProps): UseCodeEditorStateReturn {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        const savedTheme = localStorage.getItem('codeEditorTheme');
        return savedTheme ? savedTheme === 'dark' : true;
    });
    const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
    const [showDiff, setShowDiff] = useState<boolean>(!!file.diffInfo);
    const [wordWrap, setWordWrap] = useState<boolean>(() => {
        return localStorage.getItem('codeEditorWordWrap') === 'true';
    });
    const [minimapEnabled, setMinimapEnabled] = useState<boolean>(() => {
        return localStorage.getItem('codeEditorShowMinimap') !== 'false';
    });
    const [showLineNumbers, setShowLineNumbers] = useState<boolean>(() => {
        return localStorage.getItem('codeEditorLineNumbers') !== 'false';
    });
    const [fontSize, setFontSize] = useState<string>(() => {
        return localStorage.getItem('codeEditorFontSize') || '14';
    });
    const [previewMode, setPreviewMode] = useState<'edit' | 'preview' | 'split'>('edit');
    const editorRef = useRef<any>(null);

    // Toggle diff callback (stable reference for toolbar panel)
    const handleToggleDiff = useCallback(() => {
        setShowDiff(prev => !prev);
    }, []);

    // Load file content
    useEffect(() => {
        const loadFileContent = async () => {
            try {
                setLoading(true);

                // If we have diffInfo with both old and new content, show the diff directly
                if (file.diffInfo && file.diffInfo.new_string !== undefined && file.diffInfo.old_string !== undefined) {
                    setContent(file.diffInfo.new_string);
                    setLoading(false);
                    return;
                }

                // Check if this is a binary file
                const fileExt = '.' + file.name.split('.').pop()?.toLowerCase() || '';
                const isBinaryFile = BINARY_EXTENSIONS.includes(fileExt);

                if (isBinaryFile) {
                    setContent(`这个二进制文件 (${file.name}) 现在还不能在文本编辑器中预览.\n\n请你点击下载按钮保存到本地查看。`);
                    setLoading(false);
                    return;
                }

                // Load from disk
                const response = await api.readFile(file.projectName, file.path);

                if (!response.ok) {
                    throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
                }

                const responseData = await response.json();
                const data = responseData.data ?? responseData;
                setContent(data.content || '');
            } catch (error) {
                logger.error('Error loading file:', error);
                setContent(`// Error loading file: ${error.message}\n// File: ${file.name}\n// Path: ${file.path}`);
            } finally {
                setLoading(false);
            }
        };

        loadFileContent();
    }, [file, projectPath]);

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess(false);

        try {
            const response = await api.saveFile(file.projectName, file.path, content);

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || errorData.message || `Save failed: ${response.status}`);
                } else {
                    throw new Error(`Save failed: ${response.status} ${response.statusText}`);
                }
            }

            await response.json().catch(() => ({}));

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);

        } catch (error) {
            alert(`Error saving file: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDownload = () => {
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase() || '';
        const isBinaryFile = BINARY_EXTENSIONS.includes(fileExt);

        if (isBinaryFile) {
            const downloadUrl = `/api/projects/${file.projectName}/file/download?filePath=${encodeURIComponent(file.path)}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    // Settings persistence
    useEffect(() => {
        localStorage.setItem('codeEditorTheme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    useEffect(() => {
        localStorage.setItem('codeEditorWordWrap', wordWrap.toString());
    }, [wordWrap]);

    // Listen for settings changes from the Settings modal
    useEffect(() => {
        const handleStorageChange = () => {
            const newTheme = localStorage.getItem('codeEditorTheme');
            if (newTheme) setIsDarkMode(newTheme === 'dark');

            const newWordWrap = localStorage.getItem('codeEditorWordWrap');
            if (newWordWrap !== null) setWordWrap(newWordWrap === 'true');

            const newShowMinimap = localStorage.getItem('codeEditorShowMinimap');
            if (newShowMinimap !== null) setMinimapEnabled(newShowMinimap !== 'false');

            const newShowLineNumbers = localStorage.getItem('codeEditorLineNumbers');
            if (newShowLineNumbers !== null) setShowLineNumbers(newShowLineNumbers !== 'false');

            const newFontSize = localStorage.getItem('codeEditorFontSize');
            if (newFontSize) setFontSize(newFontSize);
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('codeEditorSettingsChanged', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('codeEditorSettingsChanged', handleStorageChange);
        };
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    e.preventDefault();
                    handleSave();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [content, handleSave, onClose]);

    return {
        content,
        loading,
        saving,
        isFullscreen,
        isDarkMode,
        saveSuccess,
        showDiff,
        wordWrap,
        minimapEnabled,
        showLineNumbers,
        fontSize,
        previewMode,
        editorRef,
        setContent,
        setIsFullscreen,
        setPreviewMode,
        setShowDiff,
        handleSave,
        handleDownload,
        handleToggleDiff
    };
}
