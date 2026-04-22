// CodeMirror 编辑器面板：封装编辑器实例，支持 diff 对比视图、minimap、自动换行等扩展
import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';
import { unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import type { CodeEditorFile } from '../types/editor.types';
import { getLanguageExtension } from '../utils/CodeMirrorSetup';

/**
 * CodeMirror 编辑器面板属性接口
 */
interface CodeEditorPanelProps {
    file: CodeEditorFile;                                  // 文件信息
    content: string;                                        // 编辑器内容
    showDiff: boolean;                                      // 是否显示 diff
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
 * CodeMirror 编辑器面板：封装编辑器实例，支持 diff 对比视图、minimap、自动换行等扩展
 * 纯预览模式下不渲染编辑器，节省性能
 */
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
        // 分屏模式占一半宽度，编辑模式占全部宽度
        <div className={previewMode === 'split' ? 'w-1/2 border-r border-border' : 'w-full'}>
            <CodeMirror
                ref={editorRef}                              // 编辑器实例引用
                value={content}                               // 初始内容
                onChange={setContent}                         // 内容变化回调
                extensions={[
                    ...getLanguageExtension(file.name),      // 根据文件扩展名加载语言支持
                    ...editorToolbarPanel,                   // 编辑器顶部工具栏
                    // diff 视图使用 unifiedMergeView 扩展，对比 AI 修改前后的代码差异
                    ...(file.diffInfo && showDiff && file.diffInfo.old_string !== undefined
                        ? [
                            // 统一合并视图：左右对比原内容和新内容
                            unifiedMergeView({
                                original: file.diffInfo.old_string,  // 原始内容
                                mergeControls: false,                 // 隐藏合并控制按钮
                                highlightChanges: true,              // 高亮差异部分
                                syntaxHighlightDeletions: false,      // 删除部分不高亮语法
                                gutter: true                         // 显示 diff gutter
                            }),
                            ...minimapExtension,                    // 添加 minimap（带 diff 标记）
                            ...scrollToFirstChunkExtension          // 自动滚动到第一个差异
                        ]
                        : []),
                    ...(wordWrap ? [EditorView.lineWrapping] : [])  // 自动换行扩展
                ]}
                theme={isDarkMode ? oneDark : githubLight}           // 根据模式选择主题
                height="100%"                                        // 高度填满容器
                style={{
                    fontSize: `${fontSize}px`,                      // 应用字体大小
                    height: '100%',
                }}
                basicSetup={{
                    lineNumbers: showLineNumbers,                   // 显示行号
                    foldGutter: true,                               // 显示代码折叠 gutter
                    dropCursor: false,                              // 禁用拖放光标
                    allowMultipleSelections: false,                 // 禁用多光标选择
                    indentOnInput: true,                            // 输入时自动缩进
                    bracketMatching: true,                          // 括号匹配高亮
                    closeBrackets: true,                            // 自动闭合括号
                    autocompletion: true,                           // 启用自动补全
                    highlightSelectionMatches: true,                // 高亮选中内容的匹配项
                    searchKeymap: true,                             // 启用搜索快捷键
                }}
            />
        </div>
    );
}
