// 引入 React 框架和 Lucide 图标库
import React from 'react';
import { X, Save, Download, Maximize2, Minimize2, Eye, Edit } from 'lucide-react';
import type { CodeEditorFile } from '../types/editor.types';

// 布局常量：工具栏按钮间距、图标尺寸等

// 编辑器头部栏主组件：包含文件信息和工具栏
/**
 * 编辑器头部栏属性接口
 * 定义文件信息、显示状态、操作回调等属性
 */
interface CodeEditorHeaderProps {
    file: CodeEditorFile;              // 当前打开的文件信息（包含路径、名称、diff 信息等）
    isSidebar: boolean;                 // 是否在侧边栏中显示
    isFullscreen: boolean;              // 是否全屏模式
    isMarkdownFile: boolean;            // 是否为 Markdown 文件（决定是否显示预览切换按钮）
    previewMode: 'edit' | 'preview' | 'split';  // Markdown 预览模式：编辑/预览/分屏
    saveSuccess: boolean;               // 保存是否成功（用于显示成功状态）
    saving: boolean;                    // 是否正在保存中
    onDownload: () => void;             // 下载文件回调
    onSave: () => void;                 // 保存文件回调
    onClose: () => void;                // 关闭编辑器回调
    onToggleFullscreen: () => void;     // 切换全屏模式回调
    onSetPreviewMode: (mode: 'edit' | 'preview' | 'split') => void;  // 设置预览模式回调
}

// Markdown 预览模式切换按钮组：仅在 Markdown 文件时显示
/**
 * Markdown 预览模式切换按钮组属性
 */
interface MarkdownPreviewToggleProps {
    previewMode: 'edit' | 'preview' | 'split';  // 当前预览模式
    onSetPreviewMode: (mode: 'edit' | 'preview' | 'split') => void;  // 切换模式回调
}

// Markdown 预览模式切换按钮组：编辑 / 分屏 / 纯预览
/**
 * Markdown 预览模式切换按钮组：编辑 / 分屏 / 纯预览
 * 仅在 Markdown 文件时显示，提供三种视图切换
 */
function MarkdownPreviewToggle({ previewMode, onSetPreviewMode }: MarkdownPreviewToggleProps) {
    // 当前激活的按钮样式条件：白色背景、深色文字、阴影
    const activeButtonClass = "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm";
    // 非激活按钮样式条件：灰色文本、悬停效果
    const inactiveButtonClass = "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300";

    return (
        // 按钮组容器：隐藏在移动端，显示在中等及以上屏幕
        <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800 rounded-md p-1">
            {/* 编辑模式按钮 */}
            <button
                onClick={() => onSetPreviewMode('edit')}
                className={`p-1.5 rounded transition-colors ${
                    previewMode === 'edit'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title="Edit mode"
            >
                {/* 编辑模式图标：铅笔 */}
                <Edit className="w-4 h-4" />
            </button>
            {/* 分屏视图按钮 */}
            <button
                onClick={() => onSetPreviewMode('split')}
                className={`p-1.5 rounded transition-colors ${
                    previewMode === 'split'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title="Split view"
            >
                {/* 分屏视图图标：左右分栏 */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7h6m0 10v-3m-3 3h.01M9 17h.01M15 7h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
            {/* 预览模式按钮 */}
            <button
                onClick={() => onSetPreviewMode('preview')}
                className={`p-1.5 rounded transition-colors ${
                    previewMode === 'preview'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title="Preview mode"
            >
                {/* 预览模式图标：眼睛 */}
                <Eye className="w-4 h-4" />
            </button>
        </div>
    );
}

// 保存按钮组件：显示保存状态（保存中/保存成功）
/**
 * 保存按钮属性
 */
interface SaveButtonProps {
    saving: boolean;          // 是否正在保存
    saveSuccess: boolean;     // 是否保存成功
    onSave: () => void;       // 保存回调函数
}

/**
 * 保存按钮：带加载中/保存成功两种视觉状态
 * 根据保存状态显示不同颜色和图标
 */
function SaveButton({ saving, saveSuccess, onSave }: SaveButtonProps) {
    // 按钮样式：根据保存状态动态调整背景色
    const buttonColorClass = saveSuccess
        ? 'bg-green-600 hover:bg-green-700'  // 成功状态：绿色
        : 'bg-blue-600 hover:bg-blue-700';   // 默认/保存中：蓝色

    return (
        <button
            onClick={onSave}
            disabled={saving}  // 保存中禁用按钮，防止重复提交
            className={`px-3 py-2 text-white rounded-md disabled:opacity-50 flex items-center gap-2 transition-colors min-h-[44px] md:min-h-0 ${buttonColorClass}`}
        >
            {saveSuccess ? (
                // 保存成功状态：显示对勾和 "Saved!" 文本
                // 绿色背景，对勾图标 + "Saved!" 文本
                // 2秒后自动恢复默认状态
                <>
                    <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="hidden sm:inline">Saved!</span>
                </>
            ) : (
                // 默认/保存中状态：显示软盘图标和状态文本
                // 蓝色背景，软盘图标 + "Save"/"Saving..." 文本
                // 保存中时按钮禁用，防止重复点击
                <>
                    <Save className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
                </>
            )}
        </button>
    );
}

// 编辑器工具栏：整合 Markdown 预览、下载、保存、全屏、关闭等功能
/**
 * 编辑器工具栏属性
 */
interface EditorToolbarProps {
    isMarkdownFile: boolean;                                    // 是否为 Markdown 文件
    previewMode: 'edit' | 'preview' | 'split';                 // 预览模式
    saveSuccess: boolean;                                       // 保存成功状态
    saving: boolean;                                            // 保存中状态
    isSidebar: boolean;                                         // 是否在侧边栏中
    isFullscreen: boolean;                                      // 是否全屏模式
    onDownload: () => void;                                     // 下载回调
    onSave: () => void;                                         // 保存回调
    onClose: () => void;                                        // 关闭回调
    onToggleFullscreen: () => void;                             // 切换全屏回调
    onSetPreviewMode: (mode: 'edit' | 'preview' | 'split') => void;  // 设置预览模式回调
}

/**
 * 编辑器工具栏：Markdown 预览切换、下载、保存、全屏、关闭按钮
 * 仅在非侧边栏模式下显示全屏按钮
 */
function EditorToolbar({
    isMarkdownFile,
    previewMode,
    saveSuccess,
    saving,
    isSidebar,
    isFullscreen,
    onDownload,
    onSave,
    onClose,
    onToggleFullscreen,
    onSetPreviewMode
}: EditorToolbarProps) {
    return (
        // 工具栏容器：flex 布局，固定间距，防止收缩
        // 包含：Markdown 预览切换 | 下载 | 保存 | 全屏 | 关闭
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            {/* Markdown 文件时显示预览模式切换按钮组 */}
            {isMarkdownFile && (
                <MarkdownPreviewToggle previewMode={previewMode} onSetPreviewMode={onSetPreviewMode} />
            )}

            {/* 下载文件按钮：触发浏览器下载当前文件 */}
            <button
                onClick={onDownload}
                className="p-2 md:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                title="Download file"
            >
                <Download className="w-5 h-5 md:w-4 md:h-4" />
            </button>

            {/* 保存按钮：根据状态显示不同颜色和图标 */}
            <SaveButton saving={saving} saveSuccess={saveSuccess} onSave={onSave} />

            {/* 全屏切换按钮：侧边栏模式不显示，桌面端显示 */}
            {!isSidebar && (
                <button
                    onClick={onToggleFullscreen}
                    className="hidden md:flex p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 items-center justify-center"
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
            )}

            {/* 关闭编辑器按钮：触发 onClose 回调关闭编辑器 */}
            <button
                onClick={onClose}
                className="p-2 md:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                title="Close"
            >
                <X className="w-6 h-6 md:w-4 md:h-4" />
            </button>
        </div>
    );
}

// 编辑器头部栏：显示文件名、路径、diff 标记，并嵌入工具栏
/**
 * 编辑器头部栏：显示文件名/路径、diff 标记，并嵌入工具栏
 */
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
        // 头部栏容器：左右布局，左侧文件信息，右侧工具栏
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0 min-w-0">
            {/* 左侧：文件名和路径显示区域 */}
            {/* 文件名显示主标题，diff 标记作为徽章显示在右侧 */}
            {/* 文件路径显示为灰色副标题，便于用户定位文件位置 */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                    {/* 文件名行：包含名称和 diff 标记 */}
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{file.name}</h3>
                        {/* diff 标记：仅在有 diff 信息时显示 */}
                        {/* 蓝色徽章提示用户当前显示的是变更对比视图 */}
                        {file.diffInfo && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded whitespace-nowrap">
                                Showing changes
                            </span>
                        )}
                    </div>
                    {/* 文件路径：灰色小字显示完整路径 */}
                    {/* 帮助用户确认当前编辑的是哪个文件 */}
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{file.path}</p>
                </div>
            </div>

            {/* 右侧：编辑器工具栏 */}
            {/* 包含所有编辑器操作按钮：预览、下载、保存、全屏、关闭 */}
            <EditorToolbar
                isMarkdownFile={isMarkdownFile}
                previewMode={previewMode}
                saveSuccess={saveSuccess}
                saving={saving}
                isSidebar={isSidebar}
                isFullscreen={isFullscreen}
                onDownload={onDownload}
                onSave={onSave}
                onClose={onClose}
                onToggleFullscreen={onToggleFullscreen}
                onSetPreviewMode={onSetPreviewMode}
            />
        </div>
    );
}
