import React, { useState, useEffect, useRef } from 'react';
import { logger } from '@/shared/utils/logger';
import {
  getRecordingErrorMessage,
  getButtonAppearance,
  handleRecordingComplete,
  checkMicrophoneSupport,
  stopRecording as stopRecordingHelper,
  canHandleClick,
  cleanupStream,
  getSupportedMimeType,
  setupRecorderHandlers,
  startRecording as startRecordingHelper,
  type MicState
} from './micButtonHelpers';

export interface MicButtonProps {
  onTranscript?: (text: string) => void;
  className?: string;
}

export function MicButton({ onTranscript, className = '' }: MicButtonProps) {
  const [state, setState] = useState<MicState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const { isSupported, error } = checkMicrophoneSupport();
    setIsSupported(isSupported);
    setError(error);
  }, []);

  const startRecording = () => startRecordingHelper(chunksRef, mediaRecorderRef, streamRef, setState, onTranscript, setError);

  const stopRecording = () => stopRecordingHelper(mediaRecorderRef, streamRef, setState);

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!canHandleClick(isSupported, lastTapRef)) {
      return;
    }

    logger.info('Button clicked, current state:', state);

    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  useEffect(() => {
    return () => {
      cleanupStream(streamRef);
    };
  }, []);

  const { icon, className: buttonClass, disabled } = getButtonAppearance(state, isSupported);

  return (
    <MicButtonView
      state={state}
      icon={icon}
      disabled={disabled}
      error={error}
      handleClick={handleClick}
      className={className}
    />
  );
}

/**
 * MicButton 视图组件 - 负责渲染 UI
 */
interface MicButtonViewProps {
  state: MicState;
  icon: React.ReactNode;
  disabled: boolean;
  error: string | null;
  handleClick: (e: React.MouseEvent | React.TouchEvent) => void;
  className: string;
}

function MicButtonView({ state, icon, disabled, error, handleClick, className }: MicButtonViewProps) {
  return (
    <div className="relative">
      <button
        type="button"
        style={{
          backgroundColor: state === 'recording' ? '#ef4444' :
                          state === 'transcribing' ? '#3b82f6' :
                          state === 'processing' ? '#a855f7' :
                          '#374151'
        }}
        className={`
          flex items-center justify-center
          w-12 h-12 rounded-full
          text-white transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          dark:ring-offset-gray-800
          touch-action-manipulation
          ${disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
          ${state === 'recording' ? 'animate-pulse' : ''}
          hover:opacity-90
          ${className}
        `}
        onClick={handleClick}
        disabled={disabled}
      >
        {icon}
      </button>

      {error && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2
                        bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10
                        animate-fade-in">
          {error}
        </div>
      )}

      {state === 'recording' && (
        <div className="absolute -inset-1 rounded-full border-2 border-red-500 animate-ping pointer-events-none" />
      )}

      {state === 'processing' && (
        <div className="absolute -inset-1 rounded-full border-2 border-purple-500 animate-ping pointer-events-none" />
      )}
    </div>
  );
}
