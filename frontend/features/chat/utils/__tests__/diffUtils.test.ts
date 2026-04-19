import { describe, it, expect } from 'vitest';
import { calculateDiff, createMemoizedDiff } from '../diffUtils';
import { shouldGroupWithPrevious, getDisplayName, getMessageContainerClasses, getAvatarBackgroundClass, getAvatarContent } from '../messageRenderUtils';
import type { ChatMessage } from '../../types';

describe('calculateDiff', () => {
  it('should return empty array for identical strings', () => {
    const result = calculateDiff('hello\nworld', 'hello\nworld');
    expect(result).toEqual([]);
  });

  it('should return empty array for identical empty strings', () => {
    const result = calculateDiff('', '');
    expect(result).toEqual([]);
  });

  it('should handle only additions', () => {
    const result = calculateDiff('hello', 'hello\nworld');
    expect(result).toEqual([
      { type: 'added', content: 'world', lineNum: 2 }
    ]);
  });

  it('should handle only removals', () => {
    const result = calculateDiff('hello\nworld', 'hello');
    expect(result).toEqual([
      { type: 'removed', content: 'world', lineNum: 2 }
    ]);
  });

  it('should handle mixed changes', () => {
    const result = calculateDiff('hello\nworld', 'hello\nuniverse');
    expect(result).toEqual([
      { type: 'removed', content: 'world', lineNum: 2 },
      { type: 'added', content: 'universe', lineNum: 2 }
    ]);
  });

  it('should handle empty old string with new content', () => {
    const result = calculateDiff('', 'new line');
    expect(result).toEqual([
      { type: 'added', content: 'new line', lineNum: 1 }
    ]);
  });

  it('should handle empty new string with old content', () => {
    const result = calculateDiff('old line', '');
    expect(result).toEqual([
      { type: 'removed', content: 'old line', lineNum: 1 }
    ]);
  });

  it('should handle single line changes', () => {
    const result = calculateDiff('single', 'changed');
    expect(result).toEqual([
      { type: 'removed', content: 'single', lineNum: 1 },
      { type: 'added', content: 'changed', lineNum: 1 }
    ]);
  });

  it('should handle complex multi-line changes', () => {
    const result = calculateDiff('line1\nline2\nline3', 'line1\nmodified\nline3');
    expect(result).toEqual([
      { type: 'removed', content: 'line2', lineNum: 2 },
      { type: 'added', content: 'modified', lineNum: 2 }
    ]);
  });

  it('should handle complete replacement', () => {
    const result = calculateDiff('old1\nold2', 'new1\nnew2');
    expect(result).toEqual([
      { type: 'removed', content: 'old1', lineNum: 1 },
      { type: 'added', content: 'new1', lineNum: 1 },
      { type: 'removed', content: 'old2', lineNum: 2 },
      { type: 'added', content: 'new2', lineNum: 2 }
    ]);
  });

  it('should handle strings with different lengths', () => {
    const result = calculateDiff('short', 'short\nadditional\nlines');
    expect(result).toEqual([
      { type: 'added', content: 'additional', lineNum: 2 },
      { type: 'added', content: 'lines', lineNum: 3 }
    ]);
  });
});

describe('createMemoizedDiff', () => {
  it('should return cached result for same inputs', () => {
    const memoizedDiff = createMemoizedDiff();
    const oldStr = 'hello\nworld';
    const newStr = 'hello\nuniverse';
    
    const firstResult = memoizedDiff(oldStr, newStr);
    const secondResult = memoizedDiff(oldStr, newStr);
    
    expect(firstResult).toBe(secondResult);
  });

  it('should calculate new result for different inputs', () => {
    const memoizedDiff = createMemoizedDiff();
    
    const firstResult = memoizedDiff('hello', 'world');
    const secondResult = memoizedDiff('foo', 'bar');
    
    expect(firstResult).not.toBe(secondResult);
    expect(firstResult).toEqual([
      { type: 'removed', content: 'hello', lineNum: 1 },
      { type: 'added', content: 'world', lineNum: 1 }
    ]);
    expect(secondResult).toEqual([
      { type: 'removed', content: 'foo', lineNum: 1 },
      { type: 'added', content: 'bar', lineNum: 1 }
    ]);
  });

  it('should calculate new result when old string changes', () => {
    const memoizedDiff = createMemoizedDiff();
    
    const firstResult = memoizedDiff('original', 'new');
    const secondResult = memoizedDiff('different', 'new');
    
    expect(firstResult).not.toBe(secondResult);
  });

  it('should calculate new result when new string changes', () => {
    const memoizedDiff = createMemoizedDiff();
    
    const firstResult = memoizedDiff('base', 'first');
    const secondResult = memoizedDiff('base', 'second');
    
    expect(firstResult).not.toBe(secondResult);
  });

  it('should handle cache size limit', () => {
    const memoizedDiff = createMemoizedDiff();
    
    for (let i = 0; i < 150; i++) {
      memoizedDiff(`old${i}`, `new${i}`);
    }
    
    const result = memoizedDiff('test', 'test2');
    expect(result).toEqual([
      { type: 'removed', content: 'test', lineNum: 1 },
      { type: 'added', content: 'test2', lineNum: 1 }
    ]);
  });

  it('should produce same results as calculateDiff', () => {
    const memoizedDiff = createMemoizedDiff();
    const oldStr = 'line1\nline2\nline3';
    const newStr = 'line1\nmodified\nline3';
    
    const memoizedResult = memoizedDiff(oldStr, newStr);
    const directResult = calculateDiff(oldStr, newStr);
    
    expect(memoizedResult).toEqual(directResult);
  });
});

describe('shouldGroupWithPrevious', () => {
  it('should return false when there is no previous message', () => {
    const current: ChatMessage = {
      id: '2',
      type: 'assistant',
      content: 'Hello',
      timestamp: Date.now()
    };
    
    expect(shouldGroupWithPrevious(current, undefined)).toBe(false);
  });

  it('should return true when both messages are same type', () => {
    const current: ChatMessage = {
      id: '2',
      type: 'assistant',
      content: 'Hello again',
      timestamp: Date.now()
    };
    
    const previous: ChatMessage = {
      id: '1',
      type: 'assistant',
      content: 'Hello',
      timestamp: Date.now()
    };
    
    expect(shouldGroupWithPrevious(current, previous)).toBe(true);
  });

  it('should return false when messages are different types', () => {
    const current: ChatMessage = {
      id: '2',
      type: 'user',
      content: 'Hi',
      timestamp: Date.now()
    };
    
    const previous: ChatMessage = {
      id: '1',
      type: 'assistant',
      content: 'Hello',
      timestamp: Date.now()
    };
    
    expect(shouldGroupWithPrevious(current, previous)).toBe(false);
  });

  it('should return true for user messages of same type', () => {
    const current: ChatMessage = {
      id: '2',
      type: 'user',
      content: 'Second message',
      timestamp: Date.now()
    };
    
    const previous: ChatMessage = {
      id: '1',
      type: 'user',
      content: 'First message',
      timestamp: Date.now()
    };
    
    expect(shouldGroupWithPrevious(current, previous)).toBe(true);
  });

  it('should return true for tool messages of same type', () => {
    const current: ChatMessage = {
      id: '2',
      type: 'tool',
      content: 'Tool result 2',
      timestamp: Date.now()
    };
    
    const previous: ChatMessage = {
      id: '1',
      type: 'tool',
      content: 'Tool result 1',
      timestamp: Date.now()
    };
    
    expect(shouldGroupWithPrevious(current, previous)).toBe(true);
  });

  it('should return true for error messages of same type', () => {
    const current: ChatMessage = {
      id: '2',
      type: 'error',
      content: 'Error 2',
      timestamp: Date.now()
    };
    
    const previous: ChatMessage = {
      id: '1',
      type: 'error',
      content: 'Error 1',
      timestamp: Date.now()
    };
    
    expect(shouldGroupWithPrevious(current, previous)).toBe(true);
  });

  it('should return false for system messages regardless of type', () => {
    const current: ChatMessage = {
      id: '2',
      type: 'system',
      content: 'System message',
      timestamp: Date.now()
    };
    
    const previous: ChatMessage = {
      id: '1',
      type: 'system',
      content: 'Previous system',
      timestamp: Date.now()
    };
    
    expect(shouldGroupWithPrevious(current, previous)).toBe(false);
  });
});

describe('getDisplayName', () => {
  it('should return "Error" for error type', () => {
    expect(getDisplayName('error', 'claude')).toBe('Error');
  });

  it('should return "Tool" for tool type', () => {
    expect(getDisplayName('tool', 'claude')).toBe('Tool');
  });

  it('should return "Cursor" for cursor provider', () => {
    expect(getDisplayName('assistant', 'cursor')).toBe('Cursor');
  });

  it('should return "Codex" for codex provider', () => {
    expect(getDisplayName('assistant', 'codex')).toBe('Codex');
  });

  it('should return "Claude" for default provider', () => {
    expect(getDisplayName('assistant', 'claude')).toBe('Claude');
  });

  it('should return "Claude" for unknown provider', () => {
    expect(getDisplayName('assistant', 'unknown')).toBe('Claude');
  });

  it('should prioritize error type over provider', () => {
    expect(getDisplayName('error', 'cursor')).toBe('Error');
  });

  it('should prioritize tool type over provider', () => {
    expect(getDisplayName('tool', 'codex')).toBe('Tool');
  });
});

describe('getMessageContainerClasses', () => {
  it('should return correct classes for ungrouped message', () => {
    const result = getMessageContainerClasses('assistant', false);
    expect(result).toBe('chat-message assistant  px-3 sm:px-0');
  });

  it('should return correct classes for grouped message', () => {
    const result = getMessageContainerClasses('user', true);
    expect(result).toBe('chat-message user grouped px-3 sm:px-0');
  });

  it('should handle different message types', () => {
    expect(getMessageContainerClasses('tool', false)).toBe('chat-message tool  px-3 sm:px-0');
    expect(getMessageContainerClasses('error', true)).toBe('chat-message error grouped px-3 sm:px-0');
  });

  it('should maintain consistent structure', () => {
    const result = getMessageContainerClasses('assistant', false);
    expect(result).toContain('chat-message');
    expect(result).toContain('assistant');
    expect(result).toContain('px-3');
    expect(result).toContain('sm:px-0');
  });
});

describe('getAvatarBackgroundClass', () => {
  it('should return red background for error type', () => {
    expect(getAvatarBackgroundClass('error')).toBe('bg-red-600');
  });

  it('should return gray background for tool type', () => {
    expect(getAvatarBackgroundClass('tool')).toBe('bg-gray-600 dark:bg-gray-700');
  });

  it('should return empty string for assistant type', () => {
    expect(getAvatarBackgroundClass('assistant')).toBe('');
  });

  it('should return empty string for user type', () => {
    expect(getAvatarBackgroundClass('user')).toBe('');
  });

  it('should return empty string for system type', () => {
    expect(getAvatarBackgroundClass('system')).toBe('');
  });

  it('should return empty string for unknown types', () => {
    expect(getAvatarBackgroundClass('unknown')).toBe('');
  });
});

describe('getAvatarContent', () => {
  it('should return "!" for error type', () => {
    expect(getAvatarContent('error')).toBe('!');
  });

  it('should return wrench emoji for tool type', () => {
    expect(getAvatarContent('tool')).toBe('🔧');
  });

  it('should return null for assistant type', () => {
    expect(getAvatarContent('assistant')).toBe(null);
  });

  it('should return null for user type', () => {
    expect(getAvatarContent('user')).toBe(null);
  });

  it('should return null for system type', () => {
    expect(getAvatarContent('system')).toBe(null);
  });

  it('should return null for unknown types', () => {
    expect(getAvatarContent('unknown')).toBe(null);
  });
});