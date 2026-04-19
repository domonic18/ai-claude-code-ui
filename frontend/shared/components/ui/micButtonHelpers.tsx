/**
 * micButtonHelpers.tsx
 *
 * MicButton 辅助函数 — 从 MicButton.tsx 提取
 *
 * @module shared/components/ui/micButtonHelpers
 */

import React from 'react';
import { Mic, Loader2, Brain } from 'lucide-react';
import { transcribeWithWhisper } from '@/shared/utils/audio';
import { logger } from '@/shared/utils/logger';

export type MicState = 'idle' | 'recording' | 'transcribing' | 'processing';

/**
 * 支持性检查结果接口
 */
export interface SupportCheckResult {
  isSupported: boolean;
  error: string | null;
}

/**
 * 检查浏览器是否支持麦克风功能
 * @returns 支持性检查结果
 */
export function checkMicrophoneSupport(): SupportCheckResult {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      isSupported: false,
      error: 'Microphone not supported. Please use HTTPS or a modern browser.'
    };
  }

  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    return {
      isSupported: false,
      error: 'Microphone requires HTTPS. Please use a secure connection.'
    };
  }

  return {
    isSupported: true,
    error: null
  };
}

/**
 * 根据录音错误类型返回用户友好的错误消息
 */
export function getRecordingErrorMessage(err: any): string {
  if (err.name === 'NotAllowedError') {
    return 'Microphone access denied. Please allow microphone permissions.';
  } else if (err.name === 'NotFoundError') {
    return 'No microphone found. Please check your audio devices.';
  } else if (err.name === 'NotSupportedError') {
    return 'Microphone not supported by this browser.';
  } else if (err.name === 'NotReadableError') {
    return 'Microphone is being used by another application.';
  } else if (err.message?.includes('HTTPS')) {
    return err.message;
  }
  return 'Microphone access failed';
}

/**
 * 按钮外观配置接口
 */
export interface ButtonAppearance {
  icon: React.ReactNode;
  className: string;
  disabled: boolean;
}

/**
 * 根据当前状态返回按钮外观配置
 * @param state - 当前麦克风状态
 * @param isSupported - 浏览器是否支持麦克风
 * @returns 按钮外观配置对象
 */
export function getButtonAppearance(state: MicState, isSupported: boolean): ButtonAppearance {
  if (!isSupported) {
    return {
      icon: <Mic className="w-5 h-5" />,
      className: 'bg-gray-400 cursor-not-allowed',
      disabled: true
    };
  }

  switch (state) {
    case 'recording':
      return {
        icon: <Mic className="w-5 h-5 text-white" />,
        className: 'bg-red-500 hover:bg-red-600 animate-pulse',
        disabled: false
      };
    case 'transcribing':
      return {
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        className: 'bg-blue-500 hover:bg-blue-600',
        disabled: true
      };
    case 'processing':
      return {
        icon: <Brain className="w-5 h-5 animate-pulse" />,
        className: 'bg-purple-500 hover:bg-purple-600',
        disabled: true
      };
    default:
      return {
        icon: <Mic className="w-5 h-5" />,
        className: 'bg-gray-700 hover:bg-gray-600',
        disabled: false
      };
  }
}

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

/**
 * 停止录音
 * @param mediaRecorderRef - MediaRecorder 引用
 * @param streamRef - 媒体流引用
 * @param setState - 状态设置函数
 */
export function stopRecording(
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>,
  streamRef: React.MutableRefObject<MediaStream | null>,
  setState: (state: MicState) => void
): void {
  logger.info('Stopping recording...');
  if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
    mediaRecorderRef.current.stop();
  } else {
    logger.info('Recorder not in recording state, forcing cleanup');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setState('idle');
  }
}

/**
 * 验证是否可以处理点击事件（防抖动检查）
 * @param isSupported - 浏览器是否支持
 * @param lastTapRef - 上次点击时间引用
 * @returns 是否可以处理点击
 */
export function canHandleClick(isSupported: boolean, lastTapRef: React.MutableRefObject<number>): boolean {
  if (!isSupported) {
    return false;
  }

  const now = Date.now();
  if (now - lastTapRef.current < 300) {
    logger.info('Ignoring rapid tap');
    return false;
  }
  lastTapRef.current = now;

  return true;
}

/**
 * 清理媒体流
 * @param streamRef - 媒体流引用
 */
export function cleanupStream(streamRef: React.MutableRefObject<MediaStream | null>): void {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
  }
}

/**
 * 获取支持的 MIME 类型
 * @returns 支持的音频 MIME 类型
 */
export function getSupportedMimeType(): string {
  return MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
}

/**
 * 设置 MediaRecorder 的事件处理器
 * @param recorder - MediaRecorder 实例
 * @param chunksRef - 数据块引用
 * @param mimeType - MIME 类型
 * @param streamRef - 媒体流引用
 * @param setState - 状态设置函数
 * @param onTranscript - 转录回调
 * @param setError - 错误设置函数
 */
export function setupRecorderHandlers(
  recorder: MediaRecorder,
  chunksRef: React.MutableRefObject<Blob[]>,
  mimeType: string,
  streamRef: React.MutableRefObject<MediaStream | null>,
  setState: (state: MicState) => void,
  onTranscript?: (text: string) => void,
  setError?: (error: string | null) => void
): void {
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunksRef.current.push(e.data);
    }
  };

  recorder.onstop = async () => {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    await handleRecordingComplete(blob, mimeType, streamRef, setState, onTranscript, setError);
  };
}

/**
 * 启动录音
 * @param chunksRef - 数据块引用
 * @param mediaRecorderRef - MediaRecorder 引用
 * @param streamRef - 媒体流引用
 * @param setState - 状态设置函数
 * @param onTranscript - 转录回调
 * @param setError - 错误设置函数
 * @returns Promise<void>
 */
export async function startRecording(
  chunksRef: React.MutableRefObject<Blob[]>,
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>,
  streamRef: React.MutableRefObject<MediaStream | null>,
  setState: (state: MicState) => void,
  onTranscript?: (text: string) => void,
  setError?: (error: string | null) => void
): Promise<void> {
  try {
    logger.info('Starting recording...');
    if (setError) setError(null);
    chunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access not available. Please use HTTPS or a supported browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    setupRecorderHandlers(recorder, chunksRef, mimeType, streamRef, setState, onTranscript, setError);

    recorder.start();
    setState('recording');
    logger.info('Recording started successfully');
  } catch (err: any) {
    logger.error('Failed to start recording:', err);
    if (setError) setError(getRecordingErrorMessage(err));
    setState('idle');
  }
}
