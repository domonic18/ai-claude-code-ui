// 编辑器内容区域：根据预览模式组合编辑面板和 Markdown 预览面板的布局
import React from 'react';
import type { CodeEditorFile } from '../types/editor.types';
import { CodeEditorPanel } from './CodeEditorPanel';
import { CodeEditorPreview } from './CodeEditorPreview';

/**
 * 编辑器内容区域属性接口
 */
interface CodeEditorContentProps {
    file: CodeEditorFile;                                  // 文件信息
    content: string;                                        // 编辑器内容
    showDiff: boolean;                                      // 是否显示 diff 视图
    wordWrap: boolean;                                      // 是否自动换行
    isDarkMode: boolean;                                    // 是否暗色模式
    fontSize: string;                                       // 字体大小
    showLineNumbers: boolean;                               // 是否显示行号
    previewMode: 'edit' | 'preview' | 'split';             // 预览模式
    editorRef: React.RefObject<any>;                        // CodeMirror 实例引用
    editorToolbarPanel: any[];                              // 工具栏面板扩展
    minimapExtension: any[];                                // Minimap 扩展
    scrollToFirstChunkExtension: any[];                     // 滚动到第一个 diff chunk 扩展
    setContent: (content: string) => void;                  // 设置内容回调
}

/**
 * 编辑器内容区域：根据预览模式组合编辑面板和 Markdown 预览面板的布局
 * - edit 模式：仅显示编辑器
 * - preview 模式：仅显示 Markdown 预览
 * - split 模式：左右分屏显示编辑器和预览
 */
export function CodeEditorContent({
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
}: CodeEditorContentProps) {
    return (
        // 内容容器：flex 布局，左侧编辑器，右侧预览
        <div className="flex-1 overflow-hidden flex">
            {/* CodeMirror 编辑器面板 */}
            <CodeEditorPanel
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
            {/* Markdown 预览面板（仅 Markdown 文件显示） */}
            <CodeEditorPreview content={content} previewMode={previewMode} />
        </div>
    );
}
