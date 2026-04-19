import React from 'react';

interface CodeEditorFooterProps {
    content: string;
}

export function CodeEditorFooter({ content }: CodeEditorFooterProps) {
    return (
        <div className="flex items-center justify-between p-3 border-t border-border bg-muted flex-shrink-0">
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Lines: {content.split('\n').length}</span>
                <span>Characters: {content.length}</span>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
                Press Ctrl+S to save &bull; Esc to close
            </div>
        </div>
    );
}
