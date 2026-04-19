import { useState, useEffect, useCallback } from 'react';
import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';
import type { EditorFile } from '../types/editor.types';

const BINARY_EXTENSIONS = [
    '.docx', '.pdf', '.xlsx', '.pptx', '.zip',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.mp3', '.mp4'
];

interface UseEditorFileOpsOptions {
    file: EditorFile;
    projectPath: string;
    showDiff: boolean;
}

export interface UseEditorFileOpsReturn {
    content: string;
    setContent: (content: string) => void;
    loading: boolean;
    saving: boolean;
    saveSuccess: boolean;
    handleSave: () => Promise<void>;
    handleDownload: () => void;
}

function isBinaryFile(filename: string): boolean {
    const ext = '.' + filename.split('.').pop()?.toLowerCase() || '';
    return BINARY_EXTENSIONS.includes(ext);
}

export function useEditorFileOps({ file, projectPath }: UseEditorFileOpsOptions): UseEditorFileOpsReturn {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

    // Load file content
    useEffect(() => {
        const loadFile = async () => {
            try {
                setLoading(true);

                // If we have diffInfo with both old and new content, show the diff directly
                if (file.diffInfo?.new_string !== undefined && file.diffInfo?.old_string !== undefined) {
                    setContent(file.diffInfo.new_string);
                    setLoading(false);
                    return;
                }

                if (isBinaryFile(file.name)) {
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

        loadFile();
    }, [file, projectPath]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setSaveSuccess(false);

        try {
            const response = await api.saveFile(file.projectName, file.path, content);

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || errorData.message || `Save failed: ${response.status}`);
                }
                throw new Error(`Save failed: ${response.status} ${response.statusText}`);
            }

            await response.json().catch(() => ({}));

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            alert(`Error saving file: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }, [file.projectName, file.path, content]);

    const handleDownload = useCallback(() => {
        if (isBinaryFile(file.name)) {
            const url = `/api/projects/${file.projectName}/file/download?filePath=${encodeURIComponent(file.path)}`;
            const link = document.createElement('a');
            link.href = url;
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
