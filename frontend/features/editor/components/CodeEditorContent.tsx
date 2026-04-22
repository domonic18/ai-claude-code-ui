import React from 'react';
import type { EditorFile } from '../types/editor.types';
import { CodeEditorPanel } from './CodeEditorPanel';
import { CodeEditorPreview } from './CodeEditorPreview';

interface CodeEditorContentProps {
    file: EditorFile;
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
        <div className="flex-1 overflow-hidden flex">
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
            <CodeEditorPreview content={content} previewMode={previewMode} />
        </div>
    );
}
