// 文件上传处理 hook：校验文件大小，图片类型转 base64 直接传递，其他类型走服务端上传
import { useCallback } from 'react'
import type { FileAttachment } from '../types'
import { logger } from '@/shared/utils/logger'

interface UseFileUploadParams {
  maxFileSize: number
  onAddFile?: (file: FileAttachment) => void
  handleFileUpload: (file: File, attachment: FileAttachment) => Promise<void>
}

/**
 * 文件上传处理 Hook：校验文件大小，图片类型转 base64 直接传递，其他类型走服务端上传
 */
export function useFileUpload({
  maxFileSize,
  onAddFile,
  handleFileUpload
}: UseFileUploadParams) {
  const processFiles = useCallback((files: File[]) => {
    files.forEach(file => {
      if (file.size > maxFileSize) {
        logger.error(`File ${file.name} exceeds maximum size of ${maxFileSize} bytes`)
        return
      }

      const attachment: FileAttachment = {
        id: `${file.name}-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
      }

      // 图片通过 FileReader 转 base64，作为 data URL 直接嵌入消息体
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          attachment.data = e.target?.result as string
          onAddFile?.(attachment)
        }
        reader.readAsDataURL(file)
      } else {
        // 非图片文件走服务端上传 API，支持大文件分片
        handleFileUpload(file, attachment)
      }
    })
  }, [maxFileSize, onAddFile, handleFileUpload])

  return { processFiles }
}