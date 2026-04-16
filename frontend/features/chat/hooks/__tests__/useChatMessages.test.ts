/**
 * useChatMessages Hook Tests
 *
 * Tests for the useChatMessages custom hook:
 * - Initial message state (empty, with initial messages, from localStorage)
 * - Adding messages
 * - Updating messages
 * - Removing messages
 * - Clearing messages
 * - Setting messages externally
 * - localStorage persistence
 * - Project switching behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock logger
vi.mock('@/shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock constants
vi.mock('../../constants', () => ({
  MAX_STORED_MESSAGES: 50,
  MIN_STORED_MESSAGES: 10,
}));

import { useChatMessages } from '../useChatMessages';
import type { ChatMessage } from '../../types';

const createMessage = (id: string, content: string): ChatMessage => ({
  id,
  type: 'user',
  content,
  timestamp: Date.now(),
});

describe('useChatMessages', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return empty messages by default', () => {
      const { result } = renderHook(() => useChatMessages());

      expect(result.current.messages).toEqual([]);
    });

    it('should use initial messages when provided', () => {
      const initial = [createMessage('1', 'Hello')];

      const { result } = renderHook(() =>
        useChatMessages({ initialMessages: initial })
      );

      expect(result.current.messages).toEqual(initial);
    });

    it('should load messages from localStorage when projectName is given', () => {
      const stored = [createMessage('1', 'Stored message')];
      localStorage.setItem(
        'chat_messages_my-project',
        JSON.stringify(stored)
      );

      const { result } = renderHook(() =>
        useChatMessages({ projectName: 'my-project' })
      );

      expect(result.current.messages).toEqual(stored);
    });

    it('should prefer localStorage over initial messages', () => {
      const stored = [createMessage('1', 'Stored')];
      const initial = [createMessage('2', 'Initial')];
      localStorage.setItem(
        'chat_messages_my-project',
        JSON.stringify(stored)
      );

      const { result } = renderHook(() =>
        useChatMessages({
          projectName: 'my-project',
          initialMessages: initial,
        })
      );

      expect(result.current.messages).toEqual(stored);
    });

    it('should use initial messages when localStorage has no data for project', () => {
      const initial = [createMessage('1', 'Initial')];

      const { result } = renderHook(() =>
        useChatMessages({
          projectName: 'new-project',
          initialMessages: initial,
        })
      );

      expect(result.current.messages).toEqual(initial);
    });
  });

  describe('addMessage', () => {
    it('should add a message to the list', () => {
      const { result } = renderHook(() => useChatMessages());

      const msg = createMessage('1', 'Hello');
      act(() => {
        result.current.addMessage(msg);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(msg);
    });

    it('should append message to existing messages', () => {
      const initial = [createMessage('1', 'First')];
      const { result } = renderHook(() =>
        useChatMessages({ initialMessages: initial })
      );

      act(() => {
        result.current.addMessage(createMessage('2', 'Second'));
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe('Second');
    });

    it('should persist to localStorage when projectName is set', () => {
      const { result } = renderHook(() =>
        useChatMessages({ projectName: 'test-project' })
      );

      act(() => {
        result.current.addMessage(createMessage('1', 'Hello'));
      });

      const stored = JSON.parse(
        localStorage.getItem('chat_messages_test-project')!
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].content).toBe('Hello');
    });

    it('should not persist when projectName is not set', () => {
      const { result } = renderHook(() => useChatMessages());

      act(() => {
        result.current.addMessage(createMessage('1', 'Hello'));
      });

      // No chat_messages_ keys should exist
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith('chat_messages_')
      );
      expect(keys).toHaveLength(0);
    });
  });

  describe('updateMessage', () => {
    it('should update a specific message by id', () => {
      const initial = [
        createMessage('1', 'Hello'),
        createMessage('2', 'World'),
      ];
      const { result } = renderHook(() =>
        useChatMessages({ initialMessages: initial })
      );

      act(() => {
        result.current.updateMessage('1', { content: 'Updated' });
      });

      expect(result.current.messages[0].content).toBe('Updated');
      expect(result.current.messages[1].content).toBe('World');
    });

    it('should not change other messages when updating', () => {
      const initial = [
        createMessage('1', 'First'),
        createMessage('2', 'Second'),
      ];
      const { result } = renderHook(() =>
        useChatMessages({ initialMessages: initial })
      );

      act(() => {
        result.current.updateMessage('2', { content: 'Changed' });
      });

      expect(result.current.messages[0].content).toBe('First');
      expect(result.current.messages[1].content).toBe('Changed');
    });

    it('should handle updating non-existent message gracefully', () => {
      const initial = [createMessage('1', 'Hello')];
      const { result } = renderHook(() =>
        useChatMessages({ initialMessages: initial })
      );

      act(() => {
        result.current.updateMessage('nonexistent', { content: 'Nope' });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello');
    });

    it('should persist updated messages to localStorage', () => {
      const initial = [createMessage('1', 'Hello')];
      const { result } = renderHook(() =>
        useChatMessages({
          projectName: 'test-project',
          initialMessages: initial,
        })
      );

      act(() => {
        result.current.updateMessage('1', { content: 'Updated' });
      });

      const stored = JSON.parse(
        localStorage.getItem('chat_messages_test-project')!
      );
      expect(stored[0].content).toBe('Updated');
    });
  });

  describe('removeMessage', () => {
    it('should remove a message by id', () => {
      const initial = [
        createMessage('1', 'First'),
        createMessage('2', 'Second'),
        createMessage('3', 'Third'),
      ];
      const { result } = renderHook(() =>
        useChatMessages({ initialMessages: initial })
      );

      act(() => {
        result.current.removeMessage('2');
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages.map((m) => m.id)).toEqual(['1', '3']);
    });

    it('should handle removing non-existent message gracefully', () => {
      const initial = [createMessage('1', 'Hello')];
      const { result } = renderHook(() =>
        useChatMessages({ initialMessages: initial })
      );

      act(() => {
        result.current.removeMessage('nonexistent');
      });

      expect(result.current.messages).toHaveLength(1);
    });

    it('should persist after removal', () => {
      const initial = [
        createMessage('1', 'First'),
        createMessage('2', 'Second'),
      ];
      const { result } = renderHook(() =>
        useChatMessages({
          projectName: 'test-project',
          initialMessages: initial,
        })
      );

      act(() => {
        result.current.removeMessage('1');
      });

      const stored = JSON.parse(
        localStorage.getItem('chat_messages_test-project')!
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('2');
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages', () => {
      const initial = [
        createMessage('1', 'First'),
        createMessage('2', 'Second'),
      ];
      const { result } = renderHook(() =>
        useChatMessages({ initialMessages: initial })
      );

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });

    it('should remove localStorage key when clearing', () => {
      localStorage.setItem(
        'chat_messages_test-project',
        JSON.stringify([createMessage('1', 'Data')])
      );

      const { result } = renderHook(() =>
        useChatMessages({ projectName: 'test-project' })
      );

      act(() => {
        result.current.clearMessages();
      });

      expect(localStorage.getItem('chat_messages_test-project')).toBeNull();
    });
  });

  describe('setMessages', () => {
    it('should replace all messages', () => {
      const { result } = renderHook(() => useChatMessages());

      const newMessages = [
        createMessage('a', 'A'),
        createMessage('b', 'B'),
      ];
      act(() => {
        result.current.setMessages(newMessages);
      });

      expect(result.current.messages).toEqual(newMessages);
    });

    it('should persist externally set messages', () => {
      const { result } = renderHook(() =>
        useChatMessages({ projectName: 'test-project' })
      );

      act(() => {
        result.current.setMessages([createMessage('1', 'External')]);
      });

      const stored = JSON.parse(
        localStorage.getItem('chat_messages_test-project')!
      );
      expect(stored[0].content).toBe('External');
    });
  });

  describe('External Message Sync', () => {
    it('should sync when externalMessages changes reference', () => {
      const { result, rerender } = renderHook(
        ({ externalMessages }) => useChatMessages({ externalMessages }),
        { initialProps: { externalMessages: undefined } }
      );

      expect(result.current.messages).toEqual([]);

      const external = [createMessage('1', 'From outside')];
      rerender({ externalMessages: external });

      expect(result.current.messages).toEqual(external);
    });

    it('should not re-sync when same externalMessages reference is provided', () => {
      const external = [createMessage('1', 'External')];
      const { result, rerender } = renderHook(
        ({ externalMessages }) => useChatMessages({ externalMessages }),
        { initialProps: { externalMessages: external } }
      );

      // Add a local message
      act(() => {
        result.current.addMessage(createMessage('2', 'Local'));
      });

      // Re-render with same reference - should NOT override local state
      rerender({ externalMessages: external });

      expect(result.current.messages).toHaveLength(2);
    });
  });
});
