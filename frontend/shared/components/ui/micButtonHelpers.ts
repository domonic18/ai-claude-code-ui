/**
 * micButtonHelpers.ts
 *
 * MicButton 辅助函数 — 从 MicButton.tsx 提取
 *
 * @module shared/components/ui/micButtonHelpers
 */

export type MicState = 'idle' | 'recording' | 'transcribing' | 'processing';

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
