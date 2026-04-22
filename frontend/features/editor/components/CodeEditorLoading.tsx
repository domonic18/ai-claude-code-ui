// 编辑器文件加载占位组件：侧边栏和全屏两种布局模式
import React from 'react';
import { getLoadingStyles } from '../utils/editor-styles';

interface CodeEditorLoadingProps {
    isDarkMode: boolean;
    isSidebar: boolean;
    fileName: string;
}

/**
 * 编辑器文件加载占位组件：侧边栏和全屏两种布局模式
 */
export function CodeEditorLoading({ isDarkMode, isSidebar, fileName }: CodeEditorLoadingProps) {
    return (
        <>
            <style>{getLoadingStyles(isDarkMode)}</style>
            // 侧边栏模式紧凑居中，全屏模式带半透明遮罩
            {isSidebar ? (
                <div className="w-full h-full flex items-center justify-center bg-background">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="text-gray-900 dark:text-white">Loading {fileName}...</span>
                    </div>
                </div>
            ) : (
                <div className="fixed inset-0 z-40 md:bg-black/50 md:flex md:items-center md:justify-center">
                    <div className="code-editor-loading w-full h-full md:rounded-lg md:w-auto md:h-auto p-8 flex items-center justify-center">
                        <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="text-gray-900 dark:text-white">Loading {fileName}...</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
