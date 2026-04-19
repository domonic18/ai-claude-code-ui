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

function CodeEditor({
    file,
    onClose,
    projectPath,
    isSidebar = false,
    isExpanded = false,
    onToggleExpand = null,
    className: _className = ''
}: CodeEditorComponentProps) {
    const {
        content, loading, saving, isFullscreen, isDarkMode, saveSuccess,
        showDiff, wordWrap, minimapEnabled, showLineNumbers, fontSize,
        previewMode, editorRef, setContent, setIsFullscreen, setPreviewMode,
        handleSave, handleDownload, handleToggleDiff
    } = useCodeEditorState({ file, projectPath, onClose });

    const isMarkdownFile = useMemo(() => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext === 'md' || ext === 'markdown';
    }, [file.name]);

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

    if (loading) {
        return <CodeEditorLoading isDarkMode={isDarkMode} isSidebar={isSidebar} fileName={file.name} />;
    }

    return (
        <>
            <style>{getEditorStyles(isDarkMode)}</style>
            <CodeEditorWrapper isSidebar={isSidebar} isFullscreen={isFullscreen}>
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

                <CodeEditorFooter content={content} />
            </CodeEditorWrapper>
        </>
    );
}

export default CodeEditor;
