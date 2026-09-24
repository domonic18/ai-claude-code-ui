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
  onStreamComplete?: (content: string, thinking?: string, thinkingDurationMs?: number) => void;
  /** Callback when stream updates */
  onStreamUpdate?: (content: string, thinking?: string) => void;
  /** Callback when a thinking block starts (insert in-progress thinking message) */
  onThinkingStart?: () => void;
  /** Callback when thinking delta arrives (update in-progress thinking message content) */
  onThinkingDelta?: (thinking: string) => void;
  /** Callback when a thinking segment is sealed (mark message done with duration) */
  onThinkingSeal?: (segment: { thinking: string; durationMs: number | null }) => void;
}

interface UseMessageStreamReturn {
  /** Current streaming content */
  streamingContent: string;
  /** Current streaming thinking content (current segment only) */
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
  /** Reset stream state, discards any unflushed buffered content */
  resetStream: () => void;
  /** Duration of the last thinking segment in milliseconds */
  thinkingDurationMs: number | null;
  /** Notify that a content block has started */
  onBlockStart: (blockType: string) => void;
}

interface UseStreamBufferOptions {
  /** Throttle interval for stream updates (ms) */
  throttleInterval: number;
  /** Callback when stream updates */
  onStreamUpdate?: (content: string, thinking?: string) => void;
  /** Callback when content is first added */
  onHasContent?: () => void;
  /** Callback when a content block starts (thinking/text/tool_use) */
  onBlockStart?: (blockType: string) => void;
  /** Callback when a thinking block starts (insert in-progress thinking message) */
  onThinkingStart?: () => void;
  /** Callback when thinking delta arrives (update in-progress thinking message content) */
  onThinkingDelta?: (thinking: string) => void;
  /** Callback when a thinking segment is sealed (mark message done with duration) */
  onThinkingSeal?: (segment: { thinking: string; durationMs: number | null }) => void;
}

interface UseStreamBufferReturn {
  /** Current streaming content */
  streamingContent: string;
  /** Current streaming thinking content (current segment only) */
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
  /** Reset buffers only (keep state) */
  resetBuffers: () => void;
  /** Reset all buffers, refs, and state */
  resetAll: () => void;
  /** Reset content buffers/ref/state only, keep thinking（思考框会话期间持续累积） */
  resetContent: () => void;
  /** Notify that a content block has started */
  onBlockStart: (blockType: string) => void;
  /** Ref to the last thinking segment duration (ms) */
  thinkingDurationMsRef: React.MutableRefObject<number | null>;
}

/**
 * Sub-hook for managing stream buffering with throttled updates
 *
 * @param options - Buffer options
 * @returns Buffer state and control functions
 */
function useStreamBuffer(options: UseStreamBufferOptions): UseStreamBufferReturn {
  const { throttleInterval, onStreamUpdate, onHasContent, onBlockStart, onThinkingStart, onThinkingDelta, onThinkingSeal } = options;

  // 当前显示的流式内容（已从缓冲区刷新到状态）
  const [streamingContent, setStreamingContent] = useState('');
  // 当前显示的思考过程内容（当前段，封段后清空）
  const [streamingThinking, setStreamingThinking] = useState('');
  // 内容缓冲区：临时存储接收到的流式内容片段
  const streamBufferRef = useRef('');
  // 思考过程缓冲区：临时存储接收到的思考内容片段
  const thinkingBufferRef = useRef('');
  // 节流定时器引用：控制缓冲区刷新频率
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 使用 ref 跟踪最新值以避免 stale closure
  // Note: refs are updated directly in flushBuffer() for immediate consistency.
  // We do NOT sync from state here because state updates are asynchronous -
  // a render triggered by flushBuffer() would overwrite the ref with stale state.
  const streamingContentRef = useRef('');
  const streamingThinkingRef = useRef('');
  // thinking 段计时：记录当前 thinking 块的开始时间
  const thinkingStartTimeRef = useRef<number | null>(null);
  // thinking 段时长：上一段 thinking 的耗时（毫秒）
  const thinkingDurationMsRef = useRef<number | null>(null);

  const clearStreamTimer = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  // Design: ref 先于 setState 更新，确保 timer callback 和 getBufferContent
  // 能立即读到最新值（避免 stale closure）。setState 是异步的，
  // 仅用于驱动 React 重渲染使 streamingContent state 对外可见。
  // 因此测试中应通过 onStreamUpdate 回调或 completeStream 验证内容，
  // 而非直接读取 streamingContent state（它可能尚未刷新）。
  const flushBuffer = useCallback(() => {
    if (streamBufferRef.current.length > 0) {
      // 先捕获 chunk 再清空 ref：setState 的函数式更新是异步的，
      // 若直接引用 ref，清空后 React 执行更新时读到空串，导致 state 不更新（内容丢失）。
      const contentChunk = streamBufferRef.current;
      streamingContentRef.current += contentChunk;
      setStreamingContent(prev => prev + contentChunk);
      streamBufferRef.current = '';
    }
    if (thinkingBufferRef.current.length > 0) {
      const thinkingChunk = thinkingBufferRef.current;
      streamingThinkingRef.current += thinkingChunk;
      setStreamingThinking(prev => prev + thinkingChunk);
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
      onStreamUpdate?.(streamingContentRef.current + streamBufferRef.current, streamingThinkingRef.current + thinkingBufferRef.current);
    }, throttleInterval);
  }, [flushBuffer, clearStreamTimer, throttleInterval, onStreamUpdate, onHasContent]);

  const updateStreamThinking = useCallback((thinking: string) => {
    if (!thinking) return;

    thinkingBufferRef.current += thinking;
    onThinkingDelta?.(thinking);
    clearStreamTimer();

    streamTimerRef.current = setTimeout(() => {
      flushBuffer();
      onStreamUpdate?.(streamingContentRef.current + streamBufferRef.current, streamingThinkingRef.current + thinkingBufferRef.current);
    }, throttleInterval);
  }, [flushBuffer, clearStreamTimer, throttleInterval, onStreamUpdate, onThinkingDelta]);

  // 空依赖数组：内部只读 ref，不依赖任何 state，避免 stale closure
  const getBufferContent = useCallback(() => {
    return {
      content: streamingContentRef.current + streamBufferRef.current,
      thinking: streamingThinkingRef.current + thinkingBufferRef.current,
    };
  }, []);

  const resetBuffers = useCallback(() => {
    streamBufferRef.current = '';
    thinkingBufferRef.current = '';
  }, []);

  const resetAll = useCallback(() => {
    streamBufferRef.current = '';
    thinkingBufferRef.current = '';
    streamingContentRef.current = '';
    streamingThinkingRef.current = '';
    thinkingStartTimeRef.current = null;
    thinkingDurationMsRef.current = null;
    setStreamingContent('');
    setStreamingThinking('');
  }, []);

  // 仅清空正文（buffer/ref/state），保留思考——agentic 多轮每轮 content_block_stop 触发
  // completeStream 时只清正文（已变消息），思考持续累积，避免黄框每轮闪烁消失。
  const resetContent = useCallback(() => {
    streamBufferRef.current = '';
    streamingContentRef.current = '';
    setStreamingContent('');
  }, []);

  const handleBlockStart = useCallback((blockType: string) => {
    if (blockType === 'thinking') {
      if (thinkingStartTimeRef.current !== null) {
        thinkingDurationMsRef.current = Date.now() - thinkingStartTimeRef.current;
      }
      thinkingStartTimeRef.current = Date.now();
      // 思考块开始：立即在消息列表插入进行中的思考消息（对话流内实时展示）
      onThinkingStart?.();
    } else if (blockType === 'text' || blockType === 'tool_use') {
      // text/tool_use 块开始：封段当前 thinking —— 计算时长、回调封存、清空当前段
      if (thinkingStartTimeRef.current !== null) {
        const durationMs = Date.now() - thinkingStartTimeRef.current;
        thinkingDurationMsRef.current = durationMs;
        thinkingStartTimeRef.current = null;
        // 先 flush 再读，确保封存的是完整内容（含未刷新的 buffer 尾巴）
        flushBuffer();
        const segmentThinking = streamingThinkingRef.current;
        if (segmentThinking) {
          onThinkingSeal?.({ thinking: segmentThinking, durationMs });
          // 段已落消息：清空当前段，下一段 thinking 从零开始
          streamingThinkingRef.current = '';
          setStreamingThinking('');
        }
      }
    }
    onBlockStart?.(blockType);
  }, [onBlockStart, onThinkingStart, onThinkingSeal, flushBuffer]);

  return {
    streamingContent,
    streamingThinking,
    clearStreamTimer,
    flushBuffer,
    updateStreamContent,
    updateStreamThinking,
    getBufferContent,
    resetBuffers,
    resetAll,
    resetContent,
    onBlockStart: handleBlockStart,
    thinkingDurationMsRef,
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
    throttleInterval = 20,
    onStreamComplete,
    onStreamUpdate,
    onThinkingStart,
    onThinkingDelta,
    onThinkingSeal,
  } = options;

  // 是否正在流式传输：true 表示正在接收 AI 响应
  const [isStreaming, setIsStreaming] = useState(false);
  // 内容标志：用于检测是否有实际内容（避免空响应触发回调）
  const hasContentRef = useRef(false);
  // 上一段 thinking 的耗时（毫秒），供 UI 展示「已深度思考（用时 Xs）」
  const [thinkingDurationMs, setThinkingDurationMs] = useState<number | null>(null);

  const setHasContent = useCallback(() => {
    hasContentRef.current = true;
  }, []);

  const buffer = useStreamBuffer({
    throttleInterval,
    onStreamUpdate,
    onHasContent: setHasContent,
    onThinkingStart,
    onThinkingDelta,
    onThinkingSeal,
  });

  const startStream = useCallback(() => {
    setIsStreaming(true);
    hasContentRef.current = false;
    setThinkingDurationMs(null);
    buffer.resetAll();
    buffer.clearStreamTimer();
  }, [buffer]);

  const completeStream = useCallback(() => {
    buffer.flushBuffer();
    buffer.clearStreamTimer();

    setIsStreaming(false);

    const finalContent = buffer.getBufferContent();
    const duration = buffer.thinkingDurationMsRef.current;
    if (duration !== null) {
      setThinkingDurationMs(duration);
    }

    if (hasContentRef.current) {
      onStreamComplete?.(finalContent.content, finalContent.thinking, duration ?? undefined);
    }
    // 正文 complete 后清空（已变消息）；思考保留——黄框在会话期间持续累积显示，
    // 避免 agentic 多轮每轮 content_block_stop 清空导致思考框闪烁（仅 startStream/刷新清思考）
    buffer.resetContent();
    hasContentRef.current = false;
  }, [buffer, onStreamComplete]);

  // 重置流状态。注意：与 completeStream 不同，resetStream 不刷新缓冲区，
  // 会丢弃未发送的内容。这是有意为之——resetStream 用于取消/中止流，
  // 而 completeStream 用于正常结束流并保留内容。
  const resetStream = useCallback(() => {
    buffer.clearStreamTimer();
    setIsStreaming(false);
    setThinkingDurationMs(null);
    buffer.resetAll();
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
    thinkingDurationMs,
    onBlockStart: buffer.onBlockStart,
  };
}
