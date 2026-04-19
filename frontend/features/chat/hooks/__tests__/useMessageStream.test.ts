/**
 * useMessageStream Hook Tests
 *
 * Tests for the useMessageStream custom hook:
 * - Initial state
 * - Stream lifecycle (start, update, complete, reset)
 * - Throttled content updates
 * - Thinking process handling
 * - Callback invocations
 * - Timer cleanup
 * - Buffer flushing behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useMessageStream } from '../useMessageStream';

describe('useMessageStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should return empty streaming state by default', () => {
      const { result } = renderHook(() => useMessageStream());

      expect(result.current.streamingContent).toBe('');
      expect(result.current.streamingThinking).toBe('');
      expect(result.current.isStreaming).toBe(false);
    });

    it('should use custom throttle interval when provided', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 200, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Hello');
      });

      expect(onStreamUpdate).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onStreamUpdate).toHaveBeenCalledWith('Hello', '');
    });
  });

  describe('startStream', () => {
    it('should initialize streaming state', () => {
      const { result } = renderHook(() => useMessageStream());

      act(() => {
        result.current.startStream();
      });

      expect(result.current.isStreaming).toBe(true);
      expect(result.current.streamingContent).toBe('');
      expect(result.current.streamingThinking).toBe('');
    });

    it('should clear existing content when starting new stream', () => {
      const { result } = renderHook(() => useMessageStream());

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Previous content');
        vi.advanceTimersByTime(100);
      });

      expect(result.current.streamingContent).toBe('Previous content');

      act(() => {
        result.current.startStream();
      });

      expect(result.current.streamingContent).toBe('');
      expect(result.current.isStreaming).toBe(true);
    });

    it('should clear pending timers when starting new stream', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 100, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Content');
      });

      act(() => {
        result.current.startStream();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onStreamUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateStreamContent', () => {
    it('should accumulate content in buffer before throttle interval', () => {
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 100 })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Hello');
        result.current.updateStreamContent(' World');
      });

      expect(result.current.streamingContent).toBe('');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.streamingContent).toBe('Hello World');
    });

    it('should throttle updates and respect throttle interval', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 100, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('First');
      });

      act(() => {
        vi.advanceTimersByTime(50);
        result.current.updateStreamContent(' Second');
      });

      expect(onStreamUpdate).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onStreamUpdate).toHaveBeenCalledTimes(1);
      expect(onStreamUpdate).toHaveBeenCalledWith('First Second', '');
    });

    it('should reset timer on each update', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 100, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('First');
      });

      act(() => {
        vi.advanceTimersByTime(50);
        result.current.updateStreamContent(' Updated');
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onStreamUpdate).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onStreamUpdate).toHaveBeenCalledWith('First Updated', '');
    });

    it('should ignore empty content updates', () => {
      const { result } = renderHook(() => useMessageStream());

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('');
        result.current.updateStreamContent('   ');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.streamingContent).toBe('');
    });
  });

  describe('updateStreamThinking', () => {
    it('should handle thinking updates separately from content', () => {
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 100 })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Content');
        result.current.updateStreamThinking('Thinking');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.streamingContent).toBe('Content');
      expect(result.current.streamingThinking).toBe('Thinking');
    });

    it('should throttle thinking updates', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 100, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamThinking('First thought');
      });

      act(() => {
        vi.advanceTimersByTime(50);
        result.current.updateStreamThinking(' second thought');
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onStreamUpdate).toHaveBeenCalledTimes(1);
      expect(onStreamUpdate).toHaveBeenCalledWith('', 'First thought second thought');
    });

    it('should ignore empty thinking updates', () => {
      const { result } = renderHook(() => useMessageStream());

      act(() => {
        result.current.startStream();
        result.current.updateStreamThinking('');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.streamingThinking).toBe('');
    });
  });

  describe('completeStream', () => {
    it('should flush buffered content and stop streaming', () => {
      const onStreamComplete = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ onStreamComplete })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Buffered');
      });

      expect(result.current.isStreaming).toBe(true);

      act(() => {
        result.current.completeStream();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.streamingContent).toBe('');
      expect(result.current.streamingThinking).toBe('');
      expect(onStreamComplete).toHaveBeenCalledWith('Buffered', '');
    });

    it('should call onStreamComplete with final content and thinking', () => {
      const onStreamComplete = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ onStreamComplete })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Final content');
        result.current.updateStreamThinking('Final thinking');
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.updateStreamContent(' more');
        result.current.completeStream();
      });

      expect(onStreamComplete).toHaveBeenCalledWith(
        'Final content more',
        'Final thinking'
      );
    });

    it('should not call onStreamComplete if no content was added', () => {
      const onStreamComplete = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ onStreamComplete })
      );

      act(() => {
        result.current.startStream();
        result.current.completeStream();
      });

      expect(onStreamComplete).not.toHaveBeenCalled();
    });

    it('should clear timers when completing stream', () => {
      const { result } = renderHook(() => useMessageStream());

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Content');
        result.current.completeStream();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.streamingContent).toBe('');
    });
  });

  describe('resetStream', () => {
    it('should reset all stream state to initial values', () => {
      const { result } = renderHook(() => useMessageStream());

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Content');
        result.current.updateStreamThinking('Thinking');
        vi.advanceTimersByTime(100);
      });

      expect(result.current.isStreaming).toBe(true);
      expect(result.current.streamingContent).toBe('Content');
      expect(result.current.streamingThinking).toBe('Thinking');

      act(() => {
        result.current.resetStream();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.streamingContent).toBe('');
      expect(result.current.streamingThinking).toBe('');
    });

    it('should clear timers when resetting', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 100, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Content');
        result.current.resetStream();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onStreamUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Callback Behavior', () => {
    it('should call onStreamUpdate when throttle interval elapses', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 50, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Test content');
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onStreamUpdate).toHaveBeenCalledWith('Test content', '');
    });

    it('should include both content and thinking in onStreamUpdate callback', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 100, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Content');
        result.current.updateStreamThinking('Thinking');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onStreamUpdate).toHaveBeenCalledWith('Content', 'Thinking');
    });

    it('should call onStreamComplete with final accumulated content', () => {
      const onStreamComplete = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 50, onStreamComplete })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Part 1');
        vi.advanceTimersByTime(50);
        result.current.updateStreamContent(' Part 2');
        vi.advanceTimersByTime(50);
        result.current.updateStreamContent(' Part 3');
      });

      act(() => {
        result.current.completeStream();
      });

      expect(onStreamComplete).toHaveBeenCalledWith(
        'Part 1 Part 2 Part 3',
        ''
      );
    });
  });

  describe('Timer Management', () => {
    it('should clear timer on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useMessageStream({ throttleInterval: 100 })
      );

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Content');
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.streamingContent).toBe('');
    });

    it('should handle rapid updates without timer conflicts', () => {
      const onStreamUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ throttleInterval: 50, onStreamUpdate })
      );

      act(() => {
        result.current.startStream();
        for (let i = 0; i < 10; i++) {
          result.current.updateStreamContent(`Chunk ${i} `);
        }
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onStreamUpdate).toHaveBeenCalledTimes(1);
      expect(result.current.streamingContent).toContain('Chunk 9');
    });
  });

  describe('Edge Cases', () => {
    it('should handle completing stream without starting it', () => {
      const onStreamComplete = vi.fn();
      const { result } = renderHook(() =>
        useMessageStream({ onStreamComplete })
      );

      act(() => {
        result.current.completeStream();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(onStreamComplete).not.toHaveBeenCalled();
    });

    it('should handle updating content before starting stream', () => {
      const { result } = renderHook(() => useMessageStream());

      act(() => {
        result.current.updateStreamContent('Early content');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.streamingContent).toBe('');
    });

    it('should handle multiple start and complete cycles', () => {
      const { result } = renderHook(() => useMessageStream());

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('First');
        vi.advanceTimersByTime(100);
        result.current.completeStream();
      });

      expect(result.current.streamingContent).toBe('');

      act(() => {
        result.current.startStream();
        result.current.updateStreamContent('Second');
        vi.advanceTimersByTime(100);
        result.current.completeStream();
      });

      expect(result.current.streamingContent).toBe('');
      expect(result.current.isStreaming).toBe(false);
    });
  });
});