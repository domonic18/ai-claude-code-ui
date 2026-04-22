// React Hooks：状态管理、副作用、回调函数
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';
import type { EditorFile } from '../types/editor.types';

// 二进制文件扩展名列表：这些文件无法在文本编辑器中显示
// 与 editorUtils.ts 中的 BINARY_EXTENSIONS 不同，此处不包含代码文件
const BINARY_EXTENSIONS = [
    '.docx', '.pdf', '.xlsx', '.pptx', '.zip',    // Office 文档和压缩包
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',  // 图片文件
    '.mp3', '.mp4'                                   // 音视频文件
];

// Hook 参数和返回值类型定义
/**
 * Hook 参数接口
 */
interface UseEditorFileOpsOptions {
    file: EditorFile;              // 文件信息对象
    projectPath: string;           // 项目根路径
    showDiff: boolean;             // 是否显示 diff（未使用，保留用于兼容性）
}

/**
 * Hook 返回值接口
 */
export interface UseEditorFileOpsReturn {
    content: string;                              // 文件内容
    setContent: (content: string) => void;        // 设置内容回调
    loading: boolean;                             // 加载中状态
    saving: boolean;                              // 保存中状态
    saveSuccess: boolean;                         // 保存成功状态
    handleSave: () => Promise<void>;              // 保存文件处理函数
    handleDownload: () => void;                   // 下载文件处理函数
}

/**
 * 根据文件扩展名判断是否为二进制文件（图片、文档、压缩包等）
 * @param filename - 文件名
 * @returns 是否为二进制文件
 */
function isBinaryFile(filename: string): boolean {
    const ext = '.' + filename.split('.').pop()?.toLowerCase() || '';
    return BINARY_EXTENSIONS.includes(ext);
}

/**
 * 加载文件内容：优先使用 diffInfo 中的新内容，二进制文件返回提示文本，其余从 API 读取
 * @param file - 文件信息对象
 * @returns 文件内容字符串
 */
async function loadFileContent(file: EditorFile): Promise<string> {
    // 如果有完整的 diff 信息（包含新旧内容），直接返回新内容用于对比
    // 这使得编辑器可以显示变更后的内容，而不是服务器的最新内容
    if (file.diffInfo?.new_string !== undefined && file.diffInfo?.old_string !== undefined) {
        return file.diffInfo.new_string;
    }

    // 二进制文件返回提示信息，引导用户下载到本地查看
    // 避免在编辑器中显示乱码或二进制数据
    if (isBinaryFile(file.name)) {
        return `这个二进制文件 (${file.name}) 现在还不能在文本编辑器中预览.\n\n请你点击下载按钮保存到本地查看。`;
    }

    // 从后端 API 读取文件内容
    const response = await api.readFile(file.projectName, file.path);

    if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    const data = responseData.data ?? responseData;
    return data.content || '';
}

/**
 * 触发文件下载：二进制文件走服务端下载接口，文本文件使用 Blob URL
 * @param file - 文件信息对象
 * @param content - 文件内容（仅文本文件使用）
 */
function downloadFile(file: EditorFile, content: string): void {
    if (isBinaryFile(file.name)) {
        // 二进制文件：使用服务端下载接口
        // 服务端可以直接返回文件流，避免前端加载大文件到内存
        const url = `/api/projects/${file.projectName}/file/download?filePath=${encodeURIComponent(file.path)}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // 文本文件：创建 Blob URL 触发浏览器下载
        // Blob URL 可以在浏览器端直接下载，无需经过服务器
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);  // 释放内存，防止内存泄漏
    }
}

// 主 Hook：管理文件内容加载、保存、下载的生命周期
/**
 * 编辑器文件操作 Hook：管理文件内容加载、保存、下载的生命周期
 * 提供文件内容读取、保存到服务器、本地下载等功能
 */
export function useEditorFileOps({ file, projectPath }: UseEditorFileOpsOptions): UseEditorFileOpsReturn {
    const [content, setContent] = useState<string>('');            // 文件内容
    const [loading, setLoading] = useState<boolean>(true);         // 加载中状态
    const [saving, setSaving] = useState<boolean>(false);          // 保存中状态
    const [saveSuccess, setSaveSuccess] = useState<boolean>(false); // 保存成功状态

    // 加载文件内容
    // 依赖项为 file 和 projectPath，当文件或项目路径变化时重新加载
    useEffect(() => {
        const loadFile = async () => {
            try {
                setLoading(true);
                const fileContent = await loadFileContent(file);
                setContent(fileContent);
            } catch (error) {
                // 加载失败时显示错误信息在编辑器中
                // 用户可以看到错误详情，便于调试
                logger.error('Error loading file:', error);
                setContent(`// Error loading file: ${error.message}\n// File: ${file.name}\n// Path: ${file.path}`);
            } finally {
                setLoading(false);
            }
        };

        loadFile();
    }, [file, projectPath]);

    // 保存文件到服务器
    // 使用 useCallback 避免不必要的重新渲染
    const handleSave = useCallback(async () => {
        setSaving(true);
        setSaveSuccess(false);

        try {
            // 调用后端 API 保存文件
            const response = await api.saveFile(file.projectName, file.path, content);

            if (!response.ok) {
                // 尝试解析错误响应
                // 服务器可能返回 JSON 格式的错误信息
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || errorData.message || `Save failed: ${response.status}`);
                }
                throw new Error(`Save failed: ${response.status} ${response.statusText}`);
            }

            await response.json().catch(() => ({}));

            // 显示保存成功状态，2秒后自动清除
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            // 保存失败时弹出错误提示
            // TODO: 替换为更友好的提示组件（如 toast）
            alert(`Error saving file: ${error.message}`);
        } finally {
            // 无论成功失败都重置保存状态
            setSaving(false);
        }
    }, [file.projectName, file.path, content]);

    // 下载文件到本地
    // 使用 useCallback 避免不必要的重新渲染
    const handleDownload = useCallback(() => {
        downloadFile(file, content);
    }, [file, content]);

    return {
        content,
        setContent,
        loading,
        saving,
        saveSuccess,
        handleSave,
        handleDownload
    };
}
