import React from 'react';

interface CodeEditorWrapperProps {
    isSidebar: boolean;
    isFullscreen: boolean;
    children: React.ReactNode;
}

export function CodeEditorWrapper({ isSidebar, isFullscreen, children }: CodeEditorWrapperProps) {
    return (
        <>
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
                    {children}
                </div>
            </div>
        </>
    );
}
