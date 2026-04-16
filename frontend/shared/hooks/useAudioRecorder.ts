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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

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
