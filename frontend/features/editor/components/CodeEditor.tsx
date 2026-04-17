import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';
import { unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { X, Save, Download, Maximize2, Minimize2, Eye, Edit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import DOMPurify from 'dompurify';
import { api } from '@/shared/services';
import type { CodeEditorComponentProps } from '../types/editor.types';
import { logger } from '@/shared/utils/logger';
import {
    getLanguageExtension,
    createMinimapExtension,
    createScrollToFirstChunkExtension,
    createEditorToolbarPanel
} from '../utils/CodeMirrorSetup';
import { getEditorStyles, getLoadingStyles } from '../utils/editor-styles';

// Binary file extensions that should not be displayed as text
const BINARY_EXTENSIONS = [
    '.docx', '.pdf', '.xlsx', '.pptx', '.zip',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.mp3', '.mp4'
];

function CodeEditor({
    file,
    onClose,
    projectPath,
    isSidebar = false,
    isExpanded = false,
    onToggleExpand = null,
    className = ''
}: CodeEditorComponentProps) {
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
    const editorRef = useRef<EditorView | null>(null);

    // Check if current file is a markdown file
    const isMarkdownFile = useMemo(() => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext === 'md' || ext === 'markdown';
    }, [file.name]);

    // Toggle diff callback (stable reference for toolbar panel)
    const handleToggleDiff = useCallback(() => {
        setShowDiff(prev => !prev);
    }, []);

    // ─── CodeMirror extensions ───────────────────────────

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

    // ─── File operations ─────────────────────────────────

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

    // ─── Settings persistence ────────────────────────────

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
    }, [content]);

    // ─── Render ──────────────────────────────────────────

    if (loading) {
        return (
            <>
                <style>{getLoadingStyles(isDarkMode)}</style>
                {isSidebar ? (
                    <div className="w-full h-full flex items-center justify-center bg-background">
                        <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="text-gray-900 dark:text-white">Loading {file.name}...</span>
                        </div>
                    </div>
                ) : (
                    <div className="fixed inset-0 z-40 md:bg-black/50 md:flex md:items-center md:justify-center">
                        <div className="code-editor-loading w-full h-full md:rounded-lg md:w-auto md:h-auto p-8 flex items-center justify-center">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                <span className="text-gray-900 dark:text-white">Loading {file.name}...</span>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <style>{getEditorStyles(isDarkMode)}</style>
            <div className={isSidebar ?
                'w-full h-full flex flex-col' :
                `fixed inset-0 z-40 ${
                    'md:bg-black/50 md:flex md:items-center md:justify-center md:p-4'
                } ${isFullscreen ? 'md:p-0' : ''}`}>
                <div className={isSidebar ?
                    'bg-background flex flex-col w-full h-full' :
                    `bg-background shadow-2xl flex flex-col ${
                    'w-full h-full md:rounded-lg md:shadow-2xl' +
                    (isFullscreen ? ' md:w-full md:h-full md:rounded-none' : ' md:w-full md:max-w-6xl md:h-[80vh] md:max-h-[80vh]')
                }`}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-medium text-gray-900 dark:text-white truncate">{file.name}</h3>
                                {file.diffInfo && (
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded whitespace-nowrap">
                                        Showing changes
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{file.path}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                        {/* Markdown preview toggle */}
                        {isMarkdownFile && (
                            <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-1">
                                <button
                                    onClick={() => setPreviewMode('edit')}
                                    className={`p-1.5 rounded transition-colors ${
                                        previewMode === 'edit'
                                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                    title="Edit mode"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setPreviewMode('split')}
                                    className={`p-1.5 rounded transition-colors ${
                                        previewMode === 'split'
                                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                    title="Split view"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7h6m0 10v-3m-3 3h.01M9 17h.01M15 7h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setPreviewMode('preview')}
                                    className={`p-1.5 rounded transition-colors ${
                                        previewMode === 'preview'
                                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                    title="Preview mode"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={handleDownload}
                            className="p-2 md:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                            title="Download file"
                        >
                            <Download className="w-5 h-5 md:w-4 md:h-4" />
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`px-3 py-2 text-white rounded-md disabled:opacity-50 flex items-center gap-2 transition-colors min-h-[44px] md:min-h-0 ${
                                saveSuccess
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {saveSuccess ? (
                                <>
                                    <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="hidden sm:inline">Saved!</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5 md:w-4 md:h-4" />
                                    <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
                                </>
                            )}
                        </button>

                        {!isSidebar && (
                            <button
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className="hidden md:flex p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 items-center justify-center"
                                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                            >
                                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="p-2 md:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                            title="Close"
                        >
                            <X className="w-6 h-6 md:w-4 md:h-4" />
                        </button>
                    </div>
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Editor Panel */}
                    {(previewMode === 'edit' || previewMode === 'split') && (
                        <div className={previewMode === 'split' ? 'w-1/2 border-r border-border' : 'w-full'}>
                            <CodeMirror
                                ref={editorRef}
                                value={content}
                                onChange={setContent}
                                extensions={[
                                    ...getLanguageExtension(file.name),
                                    ...editorToolbarPanel,
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
                    )}

                    {/* Preview Panel */}
                    {(previewMode === 'preview' || previewMode === 'split') && isMarkdownFile && (
                        <div className={previewMode === 'split' ? 'w-1/2' : 'w-full'}>
                            <div className="h-full overflow-auto p-6 bg-white dark:bg-gray-900">
                                <div className="max-w-none prose prose-sm dark:prose-invert">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[[rehypeKatex, { strict: false }]]}
                                        components={{
                                            code: ({node, className, children, ...props}: any) => {
                                                const match = /language-(\w+)/.exec(className || '');
                                                const isInline = !className && !match;
                                                return isInline ? (
                                                    <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm" {...props}>
                                                        {children}
                                                    </code>
                                                ) : (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            },
                                            a: ({node, children, ...props}: any) => (
                                                <a className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
                                                    {children}
                                                </a>
                                            ),
                                        }}
                                    >
                                        {DOMPurify.sanitize(content)}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-3 border-t border-border bg-muted flex-shrink-0">
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>Lines: {content.split('\n').length}</span>
                        <span>Characters: {content.length}</span>
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Press Ctrl+S to save &bull; Esc to close
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}

export default CodeEditor;
