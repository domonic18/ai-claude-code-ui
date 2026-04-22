// CodeMirror 扩展组合 hook：将 minimap、diff 跳转、工具栏面板等扩展按依赖项缓存
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

/**
 * CodeMirror 扩展组合 Hook：按依赖项缓存 minimap、diff 滚动定位、工具栏面板等扩展
 */
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
    // minimap 仅在 diff 信息或暗色模式变化时重建
    const minimapExtension = useMemo(() => createMinimapExtension({
        diffInfo: file.diffInfo,
        showDiff,
        minimapEnabled,
        isDarkMode
    }), [file.diffInfo, showDiff, minimapEnabled, isDarkMode]);

    // diff 首个变更块自动滚动定位
    const scrollToFirstChunkExtension = useMemo(() =>
        createScrollToFirstChunkExtension(file.diffInfo, showDiff)
    , [file.diffInfo, showDiff]);

    // 工具栏面板包含 diff 切换、全屏、展开等操作
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
