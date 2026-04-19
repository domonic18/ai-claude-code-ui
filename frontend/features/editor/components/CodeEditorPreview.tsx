import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import DOMPurify from 'dompurify';

interface CodeEditorPreviewProps {
    content: string;
    previewMode: 'edit' | 'preview' | 'split';
}

export function CodeEditorPreview({ content, previewMode }: CodeEditorPreviewProps) {
    if (previewMode === 'edit') {
        return null;
    }

    return (
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
    );
}
