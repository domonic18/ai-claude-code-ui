/**
 * useTerminal Hook Tests
 *
 * Tests the terminal functionality hooks:
 * - useTerminal() — Main terminal hook
 * - useTerminalOptions() — Terminal options management
 * - useTerminalScroll() — Terminal scroll management
 *
 * All external dependencies (WebSocket, callbacks, operations) are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock logger
vi.mock('@/shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock useTerminalCallbacks
const mockDisconnect = vi.fn();
const mockReconnect = vi.fn();

vi.mock('../useTerminalCallbacks', () => ({
  createConnectionCallbacks: vi.fn(() => ({
    disconnect: mockDisconnect,
    reconnect: mockReconnect,
  })),
  createWebSocketHandlers: vi.fn(),
}));

// Mock useTerminalHistory
vi.mock('../useTerminalHistory', () => ({
  useTerminalHistory: vi.fn(() => ({
    history: [],
    addCommand: vi.fn(),
    navigateUp: vi.fn(),
    navigateDown: vi.fn(),
  })),
}));

// Mock useTerminalOperations
const mockExecuteCommand = vi.fn();
const mockWriteInput = vi.fn();
const mockResizeTerminal = vi.fn();
const mockKillProcess = vi.fn();

vi.mock('../useTerminalOperations', () => ({
  createTerminalOperations: vi.fn(() => ({
    executeCommand: mockExecuteCommand,
    writeInput: mockWriteInput,
    resizeTerminal: mockResizeTerminal,
    killProcess: mockKillProcess,
  })),
}));

import { useTerminal, useTerminalOptions, useTerminalScroll } from '../useTerminal';

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return initial state with default values', () => {
    const { result } = renderHook(() => useTerminal());

    expect(result.current.process).toBeNull();
    expect(result.current.outputs).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should expose terminal operation methods', () => {
    const { result } = renderHook(() => useTerminal());

    expect(typeof result.current.executeCommand).toBe('function');
    expect(typeof result.current.writeInput).toBe('function');
    expect(typeof result.current.resizeTerminal).toBe('function');
    expect(typeof result.current.clearOutput).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.reconnect).toBe('function');
    expect(typeof result.current.killProcess).toBe('function');
  });

  it('should clear outputs when clearOutput is called', () => {
    const { result } = renderHook(() => useTerminal());

    // Initially empty
    expect(result.current.outputs).toEqual([]);

    // After clearOutput, should still be empty
    act(() => {
      result.current.clearOutput();
    });

    expect(result.current.outputs).toEqual([]);
  });

  it('should delegate executeCommand to operations', () => {
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.executeCommand('ls -la');
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith('ls -la');
  });

  it('should delegate executeCommand with args', () => {
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.executeCommand('echo', ['hello']);
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith('echo', ['hello']);
  });

  it('should delegate writeInput to operations', () => {
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.writeInput('test input');
    });

    expect(mockWriteInput).toHaveBeenCalledWith('test input');
  });

  it('should delegate resizeTerminal to operations', () => {
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.resizeTerminal(120, 40);
    });

    expect(mockResizeTerminal).toHaveBeenCalledWith(120, 40);
  });

  it('should delegate killProcess to operations', () => {
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.killProcess();
    });

    expect(mockKillProcess).toHaveBeenCalled();
  });

  it('should delegate disconnect to connection callbacks', () => {
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.disconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should delegate reconnect to connection callbacks', () => {
    const { result } = renderHook(() => useTerminal());

    act(() => {
      result.current.reconnect();
    });

    expect(mockReconnect).toHaveBeenCalled();
  });

  it('should accept custom shell option', () => {
    // Verify the hook doesn't crash with custom shell
    const { result } = renderHook(() => useTerminal({ shell: '/bin/zsh' }));
    expect(result.current).toBeDefined();
  });

  it('should accept args option', () => {
    const { result } = renderHook(() => useTerminal({ args: ['--login'] }));
    expect(result.current).toBeDefined();
  });

  it('should accept cwd option', () => {
    const { result } = renderHook(() => useTerminal({ cwd: '/home/user' }));
    expect(result.current).toBeDefined();
  });

  it('should accept env option', () => {
    const { result } = renderHook(() =>
      useTerminal({ env: { NODE_ENV: 'test' } })
    );
    expect(result.current).toBeDefined();
  });

  it('should accept callback options', () => {
    const onOutput = vi.fn();
    const onProcessComplete = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useTerminal({ onOutput, onProcessComplete, onError })
    );
    expect(result.current).toBeDefined();
  });
});

describe('useTerminalOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return default terminal options', () => {
    const { result } = renderHook(() => useTerminalOptions());

    expect(result.current.options).toEqual({
      theme: 'default',
      fontSize: 14,
      cursorBlink: true,
      scrollback: 1000,
      convertEol: true,
    });
  });

  it('should merge initial options with defaults', () => {
    const { result } = renderHook(() =>
      useTerminalOptions({ fontSize: 18 })
    );

    expect(result.current.options.fontSize).toBe(18);
    expect(result.current.options.theme).toBe('default');
    expect(result.current.options.cursorBlink).toBe(true);
  });

  it('should return theme from options', () => {
    const { result } = renderHook(() => useTerminalOptions());

    expect(result.current.theme).toBe('default');
  });

  it('should update options via updateOptions', () => {
    const { result } = renderHook(() => useTerminalOptions());

    act(() => {
      result.current.updateOptions({ fontSize: 20 });
    });

    expect(result.current.options.fontSize).toBe(20);
    expect(result.current.options.theme).toBe('default');
  });

  it('should persist options to localStorage', () => {
    const { result } = renderHook(() => useTerminalOptions());

    act(() => {
      result.current.updateOptions({ fontSize: 24 });
    });

    const stored = localStorage.getItem('terminal-options');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.fontSize).toBe(24);
  });

  it('should set theme via setTheme', () => {
    const { result } = renderHook(() => useTerminalOptions());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.options.theme).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('should reset to defaults via resetToDefaults', () => {
    const { result } = renderHook(() =>
      useTerminalOptions({ fontSize: 30 })
    );

    // Verify custom value
    expect(result.current.options.fontSize).toBe(30);

    act(() => {
      result.current.resetToDefaults();
    });

    // Should be back to default
    expect(result.current.options.fontSize).toBe(14);
    expect(result.current.options.theme).toBe('default');
  });

  it('should remove localStorage on resetToDefaults', () => {
    const { result } = renderHook(() => useTerminalOptions());

    act(() => {
      result.current.updateOptions({ fontSize: 30 });
    });
    expect(localStorage.getItem('terminal-options')).toBeTruthy();

    act(() => {
      result.current.resetToDefaults();
    });
    expect(localStorage.getItem('terminal-options')).toBeNull();
  });

  it('should handle multiple option updates', () => {
    const { result } = renderHook(() => useTerminalOptions());

    act(() => {
      result.current.updateOptions({ fontSize: 20 });
    });
    act(() => {
      result.current.updateOptions({ cursorBlink: false });
    });

    expect(result.current.options.fontSize).toBe(20);
    expect(result.current.options.cursorBlink).toBe(false);
    expect(result.current.options.scrollback).toBe(1000);
  });
});

describe('useTerminalScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return scroll utilities', () => {
    const { result } = renderHook(() => useTerminalScroll());

    expect(result.current.scrollRef).toBeDefined();
    expect(result.current.shouldAutoScroll).toBe(true);
    expect(typeof result.current.scrollToBottom).toBe('function');
    expect(typeof result.current.toggleAutoScroll).toBe('function');
  });

  it('should start with autoScroll enabled', () => {
    const { result } = renderHook(() => useTerminalScroll());

    expect(result.current.shouldAutoScroll).toBe(true);
  });

  it('should toggle autoScroll', () => {
    const { result } = renderHook(() => useTerminalScroll());

    act(() => {
      result.current.toggleAutoScroll();
    });

    expect(result.current.shouldAutoScroll).toBe(false);

    act(() => {
      result.current.toggleAutoScroll();
    });

    expect(result.current.shouldAutoScroll).toBe(true);
  });

  it('should persist autoScroll preference to localStorage', () => {
    const { result } = renderHook(() => useTerminalScroll());

    act(() => {
      result.current.toggleAutoScroll();
    });

    expect(localStorage.getItem('terminal-auto-scroll')).toBe('false');
  });

  it('should handle scrollToBottom when ref has no element', () => {
    const { result } = renderHook(() => useTerminalScroll());

    // ref.current is null, should not throw
    expect(() => {
      result.current.scrollToBottom();
    }).not.toThrow();
  });

  it('should handle scrollToBottom with mock DOM element', () => {
    const { result } = renderHook(() => useTerminalScroll());

    const mockDiv = {
      scrollTop: 0,
      scrollHeight: 500,
    };
    (result.current.scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = mockDiv as unknown as HTMLDivElement;

    act(() => {
      result.current.scrollToBottom();
    });

    expect(mockDiv.scrollTop).toBe(500);
  });
});
