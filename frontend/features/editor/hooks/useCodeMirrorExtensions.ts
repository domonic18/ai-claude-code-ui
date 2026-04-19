import { useMemo } from 'react';
import type { CodeEditorFile } from '../types/editor.types';
import {
    createMinimapExtension,
    createScrollToFirstChunkExtension,
    createEditorToolbarPanel
} from '../utils/CodeMirrorSetup';

interface UseCodeMirrorExtensionsProps {
    file: CodeEditorFile;
    showDiff: boolean;
    isDarkMode: boolean;
    isSidebar: boolean;
    isExpanded: boolean;
    onToggleExpand: (() => void) | null;
    minimapEnabled: boolean;
    handleToggleDiff: () => void;
}

interface UseCodeMirrorExtensionsReturn {
    minimapExtension: any[];
    scrollToFirstChunkExtension: any[];
    editorToolbarPanel: any[];
}

export function useCodeMirrorExtensions({
    file,
    showDiff,
    isDarkMode,
    isSidebar,
    isExpanded,
    onToggleExpand,
    minimapEnabled,
    handleToggleDiff
}: UseCodeMirrorExtensionsProps): UseCodeMirrorExtensionsReturn {
    const minimapExtension = useMemo(() => createMinimapExtension({
        diffInfo: file.diffInfo,
        showDiff,
        minimapEnabled,
        isDarkMode
    }), [file.diffInfo, showDiff, minimapEnabled, isDarkMode]);

    const scrollToFirstChunkExtension = useMemo(() =>
        createScrollToFirstChunkExtension(file.diffInfo, showDiff)
    , [file.diffInfo, showDiff]);

    const editorToolbarPanel = useMemo(() => createEditorToolbarPanel({
        diffInfo: file.diffInfo,
        showDiff,
        isDarkMode,
        isSidebar,
        isExpanded,
        onToggleExpand,
        onToggleDiff: handleToggleDiff
    }), [file.diffInfo, showDiff, isDarkMode, isSidebar, isExpanded, onToggleExpand, handleToggleDiff]);

    return {
        minimapExtension,
        scrollToFirstChunkExtension,
        editorToolbarPanel
    };
}
