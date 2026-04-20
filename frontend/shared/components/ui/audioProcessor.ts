/**
 * audioProcessor.ts
 *
 * Audio Processor
 *
 * 音频处理函数，从 micButtonHelpers.tsx 提取以降低复杂度
 *
 * @module shared/components/ui/audioProcessor
 */

import React from 'react';
import { transcribeWithWhisper } from '@/shared/utils/audio';
import { logger } from '@/shared/utils/logger';
import type { MicState } from './micButtonHelpers';

/**
 * 处理录音完成后的转录逻辑
 * @param blob - 录音数据的 Blob 对象
 * @param mimeType - MIME 类型
 * @param streamRef - 媒体流引用
 * @param setState - 状态设置函数
 * @param onTranscript - 转录完成回调
 * @param setError - 错误设置函数
 * @returns Promise<void>
 */
export async function handleRecordingComplete(
  blob: Blob,
  mimeType: string,
  streamRef: React.MutableRefObject<MediaStream | null>,
  setState: (state: MicState) => void,
  onTranscript?: (text: string) => void,
  setError?: (error: string | null) => void
): Promise<void> {
  logger.info('Recording stopped, creating blob...');

  // 停止媒体流
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  setState('transcribing');

  // 检查是否为增强模式
  const whisperMode = window.localStorage.getItem('whisperMode') || 'default';
  const isEnhancementMode = whisperMode === 'prompt' || whisperMode === 'vibe' || whisperMode === 'instructions' || whisperMode === 'architect';

  let processingTimer: ReturnType<typeof setTimeout> | undefined;
  if (isEnhancementMode) {
    processingTimer = setTimeout(() => {
      setState('processing');
    }, 2000);
  }

  try {
    const text = await transcribeWithWhisper(blob);
    if (text && onTranscript) {
      onTranscript(text);
    }
  } catch (err: any) {
    logger.error('Transcription error:', err);
    if (setError) {
      setError(err.message);
    }
  } finally {
    if (processingTimer) {
      clearTimeout(processingTimer);
    }
    setState('idle');
  }
}
