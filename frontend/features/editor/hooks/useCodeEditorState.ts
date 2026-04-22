import { useState, useEffect, useRef, useCallback } from 'react';
import type { EditorFile } from '../types/editor.types';
import { useEditorSettings } from './useEditorSettings';
import { useEditorFileOps } from './useEditorFileOps';

/**
 * Hook 参数接口
 */
interface UseCodeEditorStateProps {
    file: EditorFile;              // 文件信息对象
    projectPath: string;           // 项目根路径
    onClose: () => void;           // 关闭编辑器回调
}

/**
 * Hook 返回值接口：包含状态、设置器和操作函数
 */
interface UseCodeEditorStateReturn {
    // State - 状态值
    content: string;                              // 文件内容
    loading: boolean;                             // 加载中状态
    saving: boolean;                              // 保存中状态
    isFullscreen: boolean;                        // 是否全屏模式
    isDarkMode: boolean;                          // 是否暗色模式
    saveSuccess: boolean;                         // 保存成功状态
    showDiff: boolean;                            // 是否显示 diff 视图
    wordWrap: boolean;                            // 是否自动换行
    minimapEnabled: boolean;                      // 是否启用 minimap
    showLineNumbers: boolean;                     // 是否显示行号
    fontSize: string;                             // 字体大小
    previewMode: 'edit' | 'preview' | 'split';   // Markdown 预览模式
    editorRef: React.RefObject<any>;              // CodeMirror 实例引用

    // Setters - 状态设置函数
    setContent: (content: string) => void;        // 设置内容
    setIsFullscreen: (fullscreen: boolean) => void;  // 设置全屏状态
    setPreviewMode: (mode: 'edit' | 'preview' | 'split') => void;  // 设置预览模式
    setShowDiff: (show: boolean) => void;         // 设置 diff 显示状态

    // Actions - 操作函数
    handleSave: () => Promise<void>;              // 保存文件
    handleDownload: () => void;                   // 下载文件
    handleToggleDiff: () => void;                 // 切换 diff 显示
}

/**
 * 代码编辑器核心状态 Hook：聚合编辑器设置、文件操作、快捷键、diff 切换等状态
 * 这是编辑器的主要状态管理 Hook，整合了设置和文件操作两个子 Hook
 */
export function useCodeEditorState({
    file,
    projectPath,
    onClose
}: UseCodeEditorStateProps): UseCodeEditorStateReturn {
    // 本地状态管理
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);  // 全屏状态
    const [showDiff, setShowDiff] = useState<boolean>(!!file.diffInfo);  // diff 显示状态（初始值由文件是否有 diff 决定）
    const [previewMode, setPreviewMode] = useState<'edit' | 'preview' | 'split'>('edit');  // Markdown 预览模式
    const editorRef = useRef<any>(null);  // CodeMirror 编辑器实例引用

    // 使用子 Hook 获取编辑器设置和文件操作
    const settings = useEditorSettings();
    const fileOps = useEditorFileOps({ file, projectPath, showDiff });

    // 切换 diff 显示状态
    const handleToggleDiff = useCallback(() => {
        setShowDiff(prev => !prev);
    }, []);

    // 全局快捷键监听：Ctrl/Cmd+S 保存，Escape 关闭编辑器
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    e.preventDefault();  // 阻止浏览器默认保存行为
                    fileOps.handleSave();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);  // 清理事件监听
    }, [fileOps.handleSave, onClose]);

    return {
        // 文件操作状态
        content: fileOps.content,
        loading: fileOps.loading,
        saving: fileOps.saving,
        saveSuccess: fileOps.saveSuccess,
        // 本地状态
        isFullscreen,
        showDiff,
        previewMode,
        editorRef,
        // 编辑器设置状态
        isDarkMode: settings.isDarkMode,
        wordWrap: settings.wordWrap,
        minimapEnabled: settings.minimapEnabled,
        showLineNumbers: settings.showLineNumbers,
        fontSize: settings.fontSize,
        // 状态设置函数
        setContent: fileOps.setContent,
        setIsFullscreen,
        setPreviewMode,
        setShowDiff,
        // 操作函数
        handleSave: fileOps.handleSave,
        handleDownload: fileOps.handleDownload,
        handleToggleDiff
    };
}
