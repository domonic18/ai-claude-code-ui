import { useState, useRef, useCallback } from 'react';
import { logger } from '@/shared/utils/logger';

export interface UseAudioRecorderResult {
  isRecording: boolean;
  audioBlob: Blob | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * Setup MediaRecorder with event handlers
 */
function setupMediaRecorder(
  stream: MediaStream,
  mimeType: string,
  chunksRef: React.MutableRefObject<Blob[]>,
  setAudioBlob: (blob: Blob) => void,
  streamRef: React.MutableRefObject<MediaStream | null>,
  setRecording: (recording: boolean) => void,
  setError: (error: string) => void
): MediaRecorder {
  const recorder = new MediaRecorder(stream, { mimeType });

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data.size > 0) {
      chunksRef.current.push(e.data);
    }
  };

  recorder.onstop = () => {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    setAudioBlob(blob);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  recorder.onerror = (event: Event) => {
    logger.error('MediaRecorder error:', event);
    setError('Recording failed');
    setRecording(false);
  };

  return recorder;
}

/**
 * Get supported MIME type for MediaRecorder
 */
function getSupportedMimeType(): string {
  return MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
}

/**
 * Get media stream from microphone
 */
async function getMicrophoneStream(): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
    }
  });
}

/**
 * Stop recording and cleanup stream
 */
function stopRecording(
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>,
  streamRef: React.MutableRefObject<MediaStream | null>,
  setRecording: (recording: boolean) => void
): void {
  logger.info('Stop called, recorder state:', mediaRecorderRef.current?.state);

  try {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      logger.info('Recording stopped');
    }
  } catch (err) {
    logger.error('Error stopping recorder:', err);
  }

  setRecording(false);

  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }
}

/**
 * Hook for recording audio from the microphone
 *
 * @returns Audio recorder state and controls
 */
export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setRecording] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];

      const stream = await getMicrophoneStream();
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = setupMediaRecorder(
        stream,
        mimeType,
        chunksRef,
        setAudioBlob,
        streamRef,
        setRecording,
        setError
      );
      mediaRecorderRef.current = recorder;

      recorder.start();
      setRecording(true);
      logger.info('Recording started');
    } catch (err: any) {
      logger.error('Failed to start recording:', err);
      setError(err.message || 'Failed to start recording');
      setRecording(false);
    }
  }, []);

  const stop = useCallback(() => {
    stopRecording(mediaRecorderRef, streamRef, setRecording);
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setError(null);
    chunksRef.current = [];
  }, []);

  return {
    isRecording,
    audioBlob,
    error,
    start,
    stop,
    reset
  };
}
