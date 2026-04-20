/**
 * micRecorder.ts
 *
 * Mic Recorder
 *
 * 录音状态管理逻辑，从 micButtonHelpers.tsx 提取以降低复杂度
 *
 * @module shared/components/ui/micRecorder
 */

import React from 'react';
import { logger } from '@/shared/utils/logger';
import type { MicState } from './micButtonHelpers';

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

// Import audio processor functions
import {
  handleRecordingComplete
} from './audioProcessor';
