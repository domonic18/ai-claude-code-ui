import { useState, useEffect, useRef, useCallback } from 'react';
import type { EditorFile } from '../types/editor.types';
import { useEditorSettings } from './useEditorSettings';
import { useEditorFileOps } from './useEditorFileOps';

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

export function useCodeEditorState({
    file,
    projectPath,
    onClose
}: UseCodeEditorStateProps): UseCodeEditorStateReturn {
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [showDiff, setShowDiff] = useState<boolean>(!!file.diffInfo);
    const [previewMode, setPreviewMode] = useState<'edit' | 'preview' | 'split'>('edit');
    const editorRef = useRef<any>(null);

    const settings = useEditorSettings();
    const fileOps = useEditorFileOps({ file, projectPath, showDiff });

    const handleToggleDiff = useCallback(() => {
        setShowDiff(prev => !prev);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    e.preventDefault();
                    fileOps.handleSave();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [fileOps.handleSave, onClose]);

    return {
        content: fileOps.content,
        loading: fileOps.loading,
        saving: fileOps.saving,
        isFullscreen,
        isDarkMode: settings.isDarkMode,
        saveSuccess: fileOps.saveSuccess,
        showDiff,
        wordWrap: settings.wordWrap,
        minimapEnabled: settings.minimapEnabled,
        showLineNumbers: settings.showLineNumbers,
        fontSize: settings.fontSize,
        previewMode,
        editorRef,
        setContent: fileOps.setContent,
        setIsFullscreen,
        setPreviewMode,
        setShowDiff,
        handleSave: fileOps.handleSave,
        handleDownload: fileOps.handleDownload,
        handleToggleDiff
    };
}
