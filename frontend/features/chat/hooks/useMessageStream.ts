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

  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs for stream buffering
  const streamBufferRef = useRef('');
  const thinkingBufferRef = useRef('');
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasContentRef = useRef(false);

  /**
   * Clear the stream timer
   */
  const clearStreamTimer = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  /**
   * Flush buffered content to state
   */
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

  /**
   * Start a new stream
   */
  const startStream = useCallback(() => {
    setIsStreaming(true);
    hasContentRef.current = false;
    setStreamingContent('');
    setStreamingThinking('');
    streamBufferRef.current = '';
    thinkingBufferRef.current = '';
    clearStreamTimer();
  }, [clearStreamTimer]);

  /**
   * Update streaming content (throttled)
   */
  const updateStreamContent = useCallback((content: string) => {
    if (!content) return;

    hasContentRef.current = true;
    streamBufferRef.current += content;

    // Clear existing timer
    clearStreamTimer();

    // Set new timer to flush buffer
    streamTimerRef.current = setTimeout(() => {
      flushBuffer();
      onStreamUpdate?.(streamingContent + streamBufferRef.current, streamingThinking);
    }, throttleInterval);
  }, [flushBuffer, clearStreamTimer, throttleInterval, onStreamUpdate, streamingContent, streamingThinking]);

  /**
   * Update streaming thinking (throttled)
   */
  const updateStreamThinking = useCallback((thinking: string) => {
    if (!thinking) return;

    thinkingBufferRef.current += thinking;

    // Clear existing timer
    clearStreamTimer();

    // Set new timer to flush buffer
    streamTimerRef.current = setTimeout(() => {
      flushBuffer();
      onStreamUpdate?.(streamingContent, streamingThinking + thinkingBufferRef.current);
    }, throttleInterval);
  }, [flushBuffer, clearStreamTimer, throttleInterval, onStreamUpdate, streamingContent, streamingThinking]);

  /**
   * Complete the stream
   */
  const completeStream = useCallback(() => {
    // Flush any remaining buffered content
    flushBuffer();
    clearStreamTimer();

    setIsStreaming(false);

    // Clear streaming content to hide StreamingIndicator
    // Content is already persisted in the messages array
    setStreamingContent('');
    setStreamingThinking('');

    // Call completion callback with final content
    if (hasContentRef.current) {
      onStreamComplete?.(streamingContent + streamBufferRef.current, streamingThinking + thinkingBufferRef.current);
    }
  }, [flushBuffer, clearStreamTimer, onStreamComplete, streamingContent, streamingThinking]);

  /**
   * Reset stream state
   */
  const resetStream = useCallback(() => {
    flushBuffer();
    clearStreamTimer();
    setIsStreaming(false);
    setStreamingContent('');
    setStreamingThinking('');
    streamBufferRef.current = '';
    thinkingBufferRef.current = '';
    hasContentRef.current = false;
  }, [flushBuffer, clearStreamTimer]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearStreamTimer();
    };
  }, [clearStreamTimer]);

  return {
    streamingContent,
    streamingThinking,
    isStreaming,
    startStream,
    updateStreamContent,
    updateStreamThinking,
    completeStream,
    resetStream,
  };
}
