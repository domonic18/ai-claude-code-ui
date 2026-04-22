// CodeMirror 编辑器面板：封装编辑器实例，支持 diff 对比视图、minimap、自动换行等扩展
import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';
import { unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import type { CodeEditorFile } from '../types/editor.types';
import { getLanguageExtension } from '../utils/CodeMirrorSetup';

interface CodeEditorPanelProps {
    file: CodeEditorFile;
    content: string;
    showDiff: boolean;
    wordWrap: boolean;
    isDarkMode: boolean;
    fontSize: string;
    showLineNumbers: boolean;
    previewMode: 'edit' | 'preview' | 'split';
    editorRef: React.RefObject<any>;
    editorToolbarPanel: any[];
    minimapExtension: any[];
    scrollToFirstChunkExtension: any[];
    setContent: (content: string) => void;
}

export function CodeEditorPanel({
    file,
    content,
    showDiff,
    wordWrap,
    isDarkMode,
    fontSize,
    showLineNumbers,
    previewMode,
    editorRef,
    editorToolbarPanel,
    minimapExtension,
    scrollToFirstChunkExtension,
    setContent
}: CodeEditorPanelProps) {
    // 纯预览模式下隐藏编辑面板，节省 DOM 渲染开销
    if (previewMode === 'preview') {
        return null;
    }

    return (
        <div className={previewMode === 'split' ? 'w-1/2 border-r border-border' : 'w-full'}>
            <CodeMirror
                ref={editorRef}
                value={content}
                onChange={setContent}
                extensions={[
                    ...getLanguageExtension(file.name),
                    ...editorToolbarPanel,
                    // diff 视图使用 unifiedMergeView 扩展，对比 AI 修改前后的代码差异
                    ...(file.diffInfo && showDiff && file.diffInfo.old_string !== undefined
                        ? [
                            unifiedMergeView({
                                original: file.diffInfo.old_string,
                                mergeControls: false,
                                highlightChanges: true,
                                syntaxHighlightDeletions: false,
                                gutter: true
                            }),
                            ...minimapExtension,
                            ...scrollToFirstChunkExtension
                        ]
                        : []),
                    ...(wordWrap ? [EditorView.lineWrapping] : [])
                ]}
                theme={isDarkMode ? oneDark : githubLight}
                height="100%"
                style={{
                    fontSize: `${fontSize}px`,
                    height: '100%',
                }}
                basicSetup={{
                    lineNumbers: showLineNumbers,
                    foldGutter: true,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    highlightSelectionMatches: true,
                    searchKeymap: true,
                }}
            />
        </div>
    );
}
