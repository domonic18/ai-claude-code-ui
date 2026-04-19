import React from 'react';
import { X, Save, Download, Maximize2, Minimize2, Eye, Edit } from 'lucide-react';
import type { CodeEditorFile } from '../types/editor.types';

interface CodeEditorHeaderProps {
    file: CodeEditorFile;
    isSidebar: boolean;
    isFullscreen: boolean;
    isMarkdownFile: boolean;
    previewMode: 'edit' | 'preview' | 'split';
    saveSuccess: boolean;
    saving: boolean;
    onDownload: () => void;
    onSave: () => void;
    onClose: () => void;
    onToggleFullscreen: () => void;
    onSetPreviewMode: (mode: 'edit' | 'preview' | 'split') => void;
}

export function CodeEditorHeader({
    file,
    isSidebar,
    isFullscreen,
    isMarkdownFile,
    previewMode,
    saveSuccess,
    saving,
    onDownload,
    onSave,
    onClose,
    onToggleFullscreen,
    onSetPreviewMode
}: CodeEditorHeaderProps) {
    return (
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
                            onClick={() => onSetPreviewMode('edit')}
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
                            onClick={() => onSetPreviewMode('split')}
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
                            onClick={() => onSetPreviewMode('preview')}
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
                    onClick={onDownload}
                    className="p-2 md:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                    title="Download file"
                >
                    <Download className="w-5 h-5 md:w-4 md:h-4" />
                </button>

                <button
                    onClick={onSave}
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
                        onClick={onToggleFullscreen}
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
    );
}
