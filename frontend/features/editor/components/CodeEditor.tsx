// 代码编辑器主入口组件：组装 Header/Content/Footer 子组件，协调编辑器状态和 CodeMirror 扩展
import React, { useMemo } from 'react';
import type { CodeEditorComponentProps } from '../types/editor.types';
import { useCodeEditorState } from '../hooks/useCodeEditorState';
import { useCodeMirrorExtensions } from '../hooks/useCodeMirrorExtensions';
import { getEditorStyles } from '../utils/editor-styles';
import { CodeEditorLoading } from './CodeEditorLoading';
import { CodeEditorWrapper } from './CodeEditorWrapper';
import { CodeEditorHeader } from './CodeEditorHeader';
import { CodeEditorContent } from './CodeEditorContent';
import { CodeEditorFooter } from './CodeEditorFooter';

/**
 * 代码编辑器主入口组件：组装 Header/Content/Footer 子组件，协调编辑器状态和 CodeMirror 扩展
 * 负责编辑器整体布局、状态管理和子组件协调
 */
function CodeEditor({
    file,                              // 文件信息对象
    onClose,                           // 关闭编辑器回调
    projectPath,                       // 项目根路径
    isSidebar = false,                 // 是否在侧边栏中显示（默认 false）
    isExpanded = false,                // 是否展开状态（默认 false）
    onToggleExpand = null,             // 切换展开状态回调（可选）
    className: _className = ''         // CSS 类名（未使用，保留用于兼容性）
}: CodeEditorComponentProps) {
    // 使用自定义 Hook 管理编辑器核心状态（内容、加载、保存、全屏等）
    const {
        content, loading, saving, isFullscreen, isDarkMode, saveSuccess,
        showDiff, wordWrap, minimapEnabled, showLineNumbers, fontSize,
        previewMode, editorRef, setContent, setIsFullscreen, setPreviewMode,
        handleSave, handleDownload, handleToggleDiff
    } = useCodeEditorState({ file, projectPath, onClose });

    // 检查是否为 Markdown 文件（支持预览模式切换）
    const isMarkdownFile = useMemo(() => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext === 'md' || ext === 'markdown';
    }, [file.name]);

    // 创建 CodeMirror 扩展：minimap、diff 滚动、工具栏面板
    const { minimapExtension, scrollToFirstChunkExtension, editorToolbarPanel } =
        useCodeMirrorExtensions({
            file,
            showDiff,
            isDarkMode,
            isSidebar,
            isExpanded,
            onToggleExpand,
            minimapEnabled,
            handleToggleDiff
        });

    // 加载中状态：显示加载组件
    if (loading) {
        return <CodeEditorLoading isDarkMode={isDarkMode} isSidebar={isSidebar} fileName={file.name} />;
    }

    return (
        <>
            {/* 动态注入编辑器样式（根据暗色/亮色模式） */}
            <style>{getEditorStyles(isDarkMode)}</style>
            {/* 编辑器外壳：提供基础布局和边框 */}
            <CodeEditorWrapper isSidebar={isSidebar} isFullscreen={isFullscreen}>
                {/* 编辑器头部：文件名、工具栏按钮 */}
                <CodeEditorHeader
                    file={file}
                    isSidebar={isSidebar}
                    isFullscreen={isFullscreen}
                    isMarkdownFile={isMarkdownFile}
                    previewMode={previewMode}
                    saveSuccess={saveSuccess}
                    saving={saving}
                    onDownload={handleDownload}
                    onSave={handleSave}
                    onClose={onClose}
                    onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                    onSetPreviewMode={setPreviewMode}
                />

                {/* 编辑器内容区：CodeMirror 实例和 Markdown 预览 */}
                <CodeEditorContent
                    file={file}
                    content={content}
                    showDiff={showDiff}
                    wordWrap={wordWrap}
                    isDarkMode={isDarkMode}
                    fontSize={fontSize}
                    showLineNumbers={showLineNumbers}
                    previewMode={previewMode}
                    editorRef={editorRef}
                    editorToolbarPanel={editorToolbarPanel}
                    minimapExtension={minimapExtension}
                    scrollToFirstChunkExtension={scrollToFirstChunkExtension}
                    setContent={setContent}
                />

                {/* 编辑器底部：行号、列号、字符数统计 */}
                <CodeEditorFooter content={content} />
            </CodeEditorWrapper>
        </>
    );
}

export default CodeEditor;
