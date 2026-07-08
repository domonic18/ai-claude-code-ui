/**
 * DocumentUploadZone
 *
 * 文档拖拽/点击上传区域，嵌入「项目资料」分区作为主操作入口
 */

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Plus } from 'lucide-react';
import { logger } from '@/shared/utils/logger';

interface DocumentUploadZoneProps {
  /** 上传回调 */
  onUpload: (file: File) => Promise<void>;
  /** 是否禁用（无项目时禁用） */
  disabled?: boolean;
}

/**
 * 文档上传区域：支持拖拽和点击上传
 */
export const DocumentUploadZone: React.FC<DocumentUploadZoneProps> = ({
  onUpload,
  disabled = false,
}) => {
  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    logger.debug('[DocumentUploadZone] onDrop 触发', {
      fileCount: acceptedFiles.length,
      files: acceptedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
    });
    for (const file of acceptedFiles) {
      logger.debug('[DocumentUploadZone] 开始上传文件', { name: file.name, size: file.size });
      try {
        await onUpload(file);
        logger.debug('[DocumentUploadZone] 文件上传回调完成', { name: file.name });
      } catch (err) {
        logger.error('[DocumentUploadZone] 文件上传回调失败', { name: file.name, err });
      }
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    disabled,
    multiple: true,
    maxSize: 50 * 1024 * 1024, // 50MB
    noClick: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md border border-dashed cursor-pointer
        transition-colors text-sm
        ${disabled
          ? 'border-border/50 text-muted-foreground/40 cursor-not-allowed'
          : isDragActive
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-primary/40 text-primary hover:border-primary hover:bg-primary/5'
        }
      `}
    >
      <input {...getInputProps()} />
      <Plus className="w-3.5 h-3.5" />
      <span>{disabled ? '请先选择项目' : isDragActive ? '释放上传' : '上传资料'}</span>
    </div>
  );
};

export default DocumentUploadZone;
