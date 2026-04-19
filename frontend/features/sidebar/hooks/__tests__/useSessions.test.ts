import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessions } from '../useSessions';
import type { Session, SessionProvider, PaginatedSessionsResponse } from '../../types';

vi.mock('@/shared/utils/logger', () => ({ 
  logger: { 
    info: vi.fn(), 
    error: vi.fn(), 
    warn: vi.fn() 
  } 
}));

vi.mock('../services', () => ({ 
  getSidebarService: vi.fn() 
}));

vi.mock('../constants/sidebar.constants', () => ({ 
  SESSION_PAGINATION: { 
    INITIAL_LOAD_LIMIT: 20, 
    LOAD_MORE_LIMIT: 20, 
    MIN_LOAD_MORE_LIMIT: 5 
  } 
}));

const mockGetSessions = vi.fn();
const mockRenameSession = vi.fn();
const mockDeleteSession = vi.fn();

const mockService = {
  getSessions: mockGetSessions,
  renameSession: mockRenameSession,
  deleteSession: mockDeleteSession,
};

describe('useSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { getSidebarService } = require('../services');
    getSidebarService.mockReturnValue(mockService);
  });

  it('should return initial empty state', () => {
    const { result } = renderHook(() => useSessions());
    
    expect(result.current.sessions).toEqual({});
    expect(result.current.loadingSessions).toEqual({});
    expect(result.current.additionalSessions).toEqual({});
    expect(result.current.hasMore).toEqual({});
  });

  it('should load more sessions successfully', async () => {
    const mockSessions: Session[] = [
      { id: 'session-1', summary: 'Test Session 1', lastActivity: '2025-01-01' },
      { id: 'session-2', summary: 'Test Session 2', lastActivity: '2025-01-02' },
    ];
    const mockResponse: PaginatedSessionsResponse = {
      sessions: mockSessions,
      hasMore: true
    };
    mockGetSessions.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.loadMoreSessions('test-project');
    });

    expect(mockGetSessions).toHaveBeenCalledWith('test-project', 20, 0);
    expect(result.current.additionalSessions['test-project']).toEqual(mockSessions);
    expect(result.current.hasMore['test-project']).toBe(true);
    expect(result.current.loadingSessions['test-project']).toBe(false);
  });

  it('should append sessions when loading more sessions multiple times', async () => {
    const mockSessions1: Session[] = [
      { id: 'session-1', summary: 'Test Session 1', lastActivity: '2025-01-01' },
    ];
    const mockSessions2: Session[] = [
      { id: 'session-2', summary: 'Test Session 2', lastActivity: '2025-01-02' },
    ];

    mockGetSessions
      .mockResolvedValueOnce({ sessions: mockSessions1, hasMore: true })
      .mockResolvedValueOnce({ sessions: mockSessions2, hasMore: false });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.loadMoreSessions('test-project', 20, 0);
    });

    await act(async () => {
      await result.current.loadMoreSessions('test-project', 20, 1);
    });

    expect(result.current.additionalSessions['test-project']).toEqual([...mockSessions1, ...mockSessions2]);
    expect(result.current.hasMore['test-project']).toBe(false);
  });

  it('should handle loadMoreSessions errors', async () => {
    const mockError = new Error('Failed to load sessions');
    mockGetSessions.mockRejectedValue(mockError);

    const { result } = renderHook(() => useSessions());

    await expect(async () => {
      await act(async () => {
        await result.current.loadMoreSessions('test-project');
      });
    }).rejects.toThrow('Failed to load sessions');

    const { logger } = require('@/shared/utils/logger');
    expect(logger.error).toHaveBeenCalledWith(
      'Error loading more sessions for test-project:',
      mockError
    );
    expect(result.current.loadingSessions['test-project']).toBe(false);
  });

  it('should prevent concurrent loads for the same project', async () => {
    const mockSessions: Session[] = [
      { id: 'session-1', summary: 'Test Session 1', lastActivity: '2025-01-01' },
    ];
    const mockResponse: PaginatedSessionsResponse = {
      sessions: mockSessions,
      hasMore: false
    };
    
    mockGetSessions.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
    );

    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.loadMoreSessions('test-project');
      result.current.loadMoreSessions('test-project');
    });

    expect(mockGetSessions).toHaveBeenCalledTimes(1);
  });

  it('should initialize hasMore for a project', () => {
    const { result } = renderHook(() => useSessions());

    act(() => {
      result.current.initializeHasMore('test-project', true);
    });

    expect(result.current.hasMore['test-project']).toBe(true);
  });

  it('should rename session and update both sessions and additionalSessions', async () => {
    const initialSessions: Session[] = [
      { id: 'session-1', summary: 'Old Summary', lastActivity: '2025-01-01' },
      { id: 'session-2', summary: 'Another Session', lastActivity: '2025-01-02' },
    ];

    mockGetSessions.mockResolvedValue({ sessions: initialSessions, hasMore: false });
    mockRenameSession.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.loadMoreSessions('test-project');
    });

    await act(async () => {
      await result.current.renameSession('test-project', 'session-1', 'New Summary');
    });

    expect(mockRenameSession).toHaveBeenCalledWith('test-project', 'session-1', 'New Summary');

    const expectedSessions = [
      { id: 'session-1', summary: 'New Summary', lastActivity: '2025-01-01' },
      { id: 'session-2', summary: 'Another Session', lastActivity: '2025-01-02' },
    ];

    expect(result.current.additionalSessions['test-project']).toEqual(expectedSessions);
  });

  it('should handle renameSession errors', async () => {
    const mockError = new Error('Failed to rename session');
    mockRenameSession.mockRejectedValue(mockError);

    const { result } = renderHook(() => useSessions());

    await expect(async () => {
      await act(async () => {
        await result.current.renameSession('test-project', 'session-1', 'New Summary');
      });
    }).rejects.toThrow('Failed to rename session');

    const { logger } = require('@/shared/utils/logger');
    expect(logger.error).toHaveBeenCalledWith(
      'Error renaming session session-1:',
      mockError
    );
  });

  it('should delete session from additionalSessions', async () => {
    const initialSessions: Session[] = [
      { id: 'session-1', summary: 'Session 1', lastActivity: '2025-01-01' },
      { id: 'session-2', summary: 'Session 2', lastActivity: '2025-01-02' },
      { id: 'session-3', summary: 'Session 3', lastActivity: '2025-01-03' },
    ];

    mockGetSessions.mockResolvedValue({ sessions: initialSessions, hasMore: false });
    mockDeleteSession.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.loadMoreSessions('test-project');
    });

    await act(async () => {
      await result.current.deleteSession('test-project', 'session-2', 'claude');
    });

    expect(mockDeleteSession).toHaveBeenCalledWith('test-project', 'session-2', 'claude');

    const expectedSessions = [
      { id: 'session-1', summary: 'Session 1', lastActivity: '2025-01-01' },
      { id: 'session-3', summary: 'Session 3', lastActivity: '2025-01-03' },
    ];

    expect(result.current.additionalSessions['test-project']).toEqual(expectedSessions);
  });

  it('should handle deleteSession without provider', async () => {
    const initialSessions: Session[] = [
      { id: 'session-1', summary: 'Session 1', lastActivity: '2025-01-01' },
    ];

    mockGetSessions.mockResolvedValue({ sessions: initialSessions, hasMore: false });
    mockDeleteSession.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.loadMoreSessions('test-project');
    });

    await act(async () => {
      await result.current.deleteSession('test-project', 'session-1');
    });

    expect(mockDeleteSession).toHaveBeenCalledWith('test-project', 'session-1', undefined);
    expect(result.current.additionalSessions['test-project']).toEqual([]);
  });

  it('should handle deleteSession errors', async () => {
    const mockError = new Error('Failed to delete session');
    mockDeleteSession.mockRejectedValue(mockError);

    const { result } = renderHook(() => useSessions());

    await expect(async () => {
      await act(async () => {
        await result.current.deleteSession('test-project', 'session-1', 'claude');
      });
    }).rejects.toThrow('Failed to delete session');

    const { logger } = require('@/shared/utils/logger');
    expect(logger.error).toHaveBeenCalledWith(
      'Error deleting session session-1:',
      mockError
    );
  });

  it('should reset all state', async () => {
    mockGetSessions.mockResolvedValue({
      sessions: [{ id: 'session-1', summary: 'Test', lastActivity: '2025-01-01' }],
      hasMore: true,
    });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.loadMoreSessions('test-project');
    });

    expect(result.current.additionalSessions['test-project'].length).toBe(1);
    expect(result.current.hasMore['test-project']).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.sessions).toEqual({});
    expect(result.current.additionalSessions).toEqual({});
    expect(result.current.hasMore).toEqual({});
  });

  it('should handle multiple projects independently', async () => {
    const project1Sessions: Session[] = [
      { id: 'session-1', summary: 'Project 1 Session', lastActivity: '2025-01-01' },
    ];
    const project2Sessions: Session[] = [
      { id: 'session-2', summary: 'Project 2 Session', lastActivity: '2025-01-02' },
    ];

    mockGetSessions
      .mockResolvedValueOnce({ sessions: project1Sessions, hasMore: true })
      .mockResolvedValueOnce({ sessions: project2Sessions, hasMore: false });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.loadMoreSessions('project-1');
    });

    await act(async () => {
      await result.current.loadMoreSessions('project-2');
    });

    expect(result.current.additionalSessions['project-1']).toEqual(project1Sessions);
    expect(result.current.additionalSessions['project-2']).toEqual(project2Sessions);
    expect(result.current.hasMore['project-1']).toBe(true);
    expect(result.current.hasMore['project-2']).toBe(false);
  });

  it('should handle custom limit and offset in loadMoreSessions', async () => {
    const mockSessions: Session[] = [
      { id: 'session-1', summary: 'Test Session', lastActivity: '2025-01-01' },
    ];
    mockGetSessions.mockResolvedValue({ sessions: mockSessions, hasMore: false });

    const { result } = renderHook(() => useSessions());

    await act(async () => {
      await result.current.loadMoreSessions('test-project', 10, 5);
    });

    expect(mockGetSessions).toHaveBeenCalledWith('test-project', 10, 5);
  });
});
