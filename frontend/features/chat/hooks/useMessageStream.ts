/**
 * useMessageStream Hook
 *
 * Manages streaming message state including:
 * - Streaming content accumulation
 * - Throttled updates for performance
 * - Thinking process handling
 * - Stream completion detection
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseMessageStreamOptions {
  /** Throttle interval for stream updates (ms) */
  throttleInterval?: number;
  /** Callback when stream completes */
  onStreamComplete?: (content: string, thinking?: string) => void;
  /** Callback when stream updates */
  onStreamUpdate?: (content: string, thinking?: string) => void;
}

interface UseMessageStreamReturn {
  /** Current streaming content */
  streamingContent: string;
  /** Current streaming thinking content */
  streamingThinking: string;
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Start a new stream */
  startStream: () => void;
  /** Update streaming content */
  updateStreamContent: (content: string) => void;
  /** Update streaming thinking */
  updateStreamThinking: (thinking: string) => void;
  /** Complete the stream */
  completeStream: () => void;
  /** Reset stream state */
  resetStream: () => void;
}

interface UseStreamBufferOptions {
  /** Throttle interval for stream updates (ms) */
  throttleInterval: number;
  /** Callback when stream updates */
  onStreamUpdate?: (content: string, thinking?: string) => void;
  /** Callback when content is first added */
  onHasContent?: () => void;
}

interface UseStreamBufferReturn {
  /** Current streaming content */
  streamingContent: string;
  /** Current streaming thinking content */
  streamingThinking: string;
  /** Clear the stream timer */
  clearStreamTimer: () => void;
  /** Flush buffered content to state */
  flushBuffer: () => void;
  /** Update streaming content (throttled) */
  updateStreamContent: (content: string) => void;
  /** Update streaming thinking (throttled) */
  updateStreamThinking: (thinking: string) => void;
  /** Get buffer content */
  getBufferContent: () => { content: string; thinking: string };
  /** Reset buffers */
  resetBuffers: () => void;
}

/**
 * Sub-hook for managing stream buffering with throttled updates
 *
 * @param options - Buffer options
 * @returns Buffer state and control functions
 */
function useStreamBuffer(options: UseStreamBufferOptions): UseStreamBufferReturn {
  const { throttleInterval, onStreamUpdate, onHasContent } = options;

  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const streamBufferRef = useRef('');
  const thinkingBufferRef = useRef('');
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStreamTimer = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  const flushBuffer = useCallback(() => {
    if (streamBufferRef.current.length > 0) {
      setStreamingContent(prev => prev + streamBufferRef.current);
      streamBufferRef.current = '';
    }
    if (thinkingBufferRef.current.length > 0) {
      setStreamingThinking(prev => prev + thinkingBufferRef.current);
      thinkingBufferRef.current = '';
    }
  }, []);

  const updateStreamContent = useCallback((content: string) => {
    if (!content) return;

    onHasContent?.();

    streamBufferRef.current += content;
    clearStreamTimer();

    streamTimerRef.current = setTimeout(() => {
      flushBuffer();
      onStreamUpdate?.(streamingContent + streamBufferRef.current, streamingThinking);
    }, throttleInterval);
  }, [flushBuffer, clearStreamTimer, throttleInterval, onStreamUpdate, onHasContent, streamingContent, streamingThinking]);

  const updateStreamThinking = useCallback((thinking: string) => {
    if (!thinking) return;

    thinkingBufferRef.current += thinking;
    clearStreamTimer();

    streamTimerRef.current = setTimeout(() => {
      flushBuffer();
      onStreamUpdate?.(streamingContent, streamingThinking + thinkingBufferRef.current);
    }, throttleInterval);
  }, [flushBuffer, clearStreamTimer, throttleInterval, onStreamUpdate, streamingContent, streamingThinking]);

  const getBufferContent = useCallback(() => {
    return {
      content: streamingContent + streamBufferRef.current,
      thinking: streamingThinking + thinkingBufferRef.current,
    };
  }, [streamingContent, streamingThinking]);

  const resetBuffers = useCallback(() => {
    streamBufferRef.current = '';
    thinkingBufferRef.current = '';
  }, []);

  return {
    streamingContent,
    streamingThinking,
    clearStreamTimer,
    flushBuffer,
    updateStreamContent,
    updateStreamThinking,
    getBufferContent,
    resetBuffers,
  };
}

/**
 * Hook for managing streaming message state
 *
 * @param options - Stream options
 * @returns Stream state and controls
 */
export function useMessageStream(options: UseMessageStreamOptions = {}): UseMessageStreamReturn {
  const {
    throttleInterval = 100,
    onStreamComplete,
    onStreamUpdate,
  } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const hasContentRef = useRef(false);

  const setHasContent = useCallback(() => {
    hasContentRef.current = true;
  }, []);

  const buffer = useStreamBuffer({
    throttleInterval,
    onStreamUpdate,
    onHasContent: setHasContent
  });

  const startStream = useCallback(() => {
    setIsStreaming(true);
    hasContentRef.current = false;
    buffer.resetBuffers();
    buffer.clearStreamTimer();
  }, [buffer]);

  const completeStream = useCallback(() => {
    buffer.flushBuffer();
    buffer.clearStreamTimer();

    setIsStreaming(false);

    const finalContent = buffer.getBufferContent();

    if (hasContentRef.current) {
      onStreamComplete?.(finalContent.content, finalContent.thinking);
    }
  }, [buffer, onStreamComplete]);

  const resetStream = useCallback(() => {
    buffer.flushBuffer();
    buffer.clearStreamTimer();
    setIsStreaming(false);
    buffer.resetBuffers();
    hasContentRef.current = false;
  }, [buffer]);

  useEffect(() => {
    return () => {
      buffer.clearStreamTimer();
    };
  }, [buffer]);

  return {
    streamingContent: buffer.streamingContent,
    streamingThinking: buffer.streamingThinking,
    isStreaming,
    startStream,
    updateStreamContent: buffer.updateStreamContent,
    updateStreamThinking: buffer.updateStreamThinking,
    completeStream,
    resetStream,
  };
}
