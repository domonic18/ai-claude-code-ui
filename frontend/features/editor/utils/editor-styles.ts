/**
 * CodeEditor 样式模板
 *
 * 生成 CodeMirror 编辑器的动态 CSS 样式。
 * 根据 isDarkMode 生成不同的配色方案。
 *
 * @module features/editor/utils/editor-styles
 */

/**
 * 生成编辑器主样式（diff 高亮、minimap、工具栏）
 * @param {boolean} isDarkMode - 是否深色模式
 * @returns {string} CSS 样式文本
 */
export function getEditorStyles(isDarkMode: boolean): string {
    return `
        /* Light background for full line changes */
        .cm-deletedChunk {
            background-color: ${isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 235, 235, 1)'} !important;
            border-left: 3px solid ${isDarkMode ? 'rgba(239, 68, 68, 0.6)' : 'rgb(239, 68, 68)'} !important;
            padding-left: 4px !important;
        }

        .cm-insertedChunk {
            background-color: ${isDarkMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(230, 255, 237, 1)'} !important;
            border-left: 3px solid ${isDarkMode ? 'rgba(34, 197, 94, 0.6)' : 'rgb(34, 197, 94)'} !important;
            padding-left: 4px !important;
        }

        /* Override linear-gradient underline and use solid darker background for partial changes */
        .cm-editor.cm-merge-b .cm-changedText {
            background: ${isDarkMode ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.3)'} !important;
            padding-top: 2px !important;
            padding-bottom: 2px !important;
            margin-top: -2px !important;
            margin-bottom: -2px !important;
        }

        .cm-editor .cm-deletedChunk .cm-changedText {
            background: ${isDarkMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)'} !important;
            padding-top: 2px !important;
            padding-bottom: 2px !important;
            margin-top: -2px !important;
            margin-bottom: -2px !important;
        }

        /* Minimap gutter styling */
        .cm-gutter.cm-gutter-minimap {
            background-color: ${isDarkMode ? '#1e1e1e' : '#f5f5f5'};
        }

        /* Editor toolbar panel styling */
        .cm-editor-toolbar-panel {
            padding: 8px 12px;
            background-color: ${isDarkMode ? '#1f2937' : '#ffffff'};
            border-bottom: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'};
            color: ${isDarkMode ? '#d1d5db' : '#374151'};
            font-size: 14px;
        }

        .cm-diff-nav-btn,
        .cm-toolbar-btn {
            padding: 4px;
            background: transparent;
            border: none;
            cursor: pointer;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: inherit;
            transition: background-color 0.2s;
        }

        .cm-diff-nav-btn:hover,
        .cm-toolbar-btn:hover {
            background-color: ${isDarkMode ? '#374151' : '#f3f4f6'};
        }

        .cm-diff-nav-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    `;
}

/**
 * 生成加载中状态样式
 * @param {boolean} isDarkMode - 是否深色模式
 * @returns {string} CSS 样式文本
 */
export function getLoadingStyles(isDarkMode: boolean): string {
    return `
        .code-editor-loading {
            background-color: ${isDarkMode ? '#111827' : '#ffffff'} !important;
        }
        .code-editor-loading:hover {
            background-color: ${isDarkMode ? '#111827' : '#ffffff'} !important;
        }
    `;
}
