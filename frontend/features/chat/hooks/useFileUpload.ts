import { useCallback } from 'react'
import type { FileAttachment } from '../types'
import { logger } from '@/shared/utils/logger'

interface UseFileUploadParams {
  maxFileSize: number
  onAddFile?: (file: FileAttachment) => void
  handleFileUpload: (file: File, attachment: FileAttachment) => Promise<void>
}

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

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          attachment.data = e.target?.result as string
          onAddFile?.(attachment)
        }
        reader.readAsDataURL(file)
      } else {
        handleFileUpload(file, attachment)
      }
    })
  }, [maxFileSize, onAddFile, handleFileUpload])

  return { processFiles }
}