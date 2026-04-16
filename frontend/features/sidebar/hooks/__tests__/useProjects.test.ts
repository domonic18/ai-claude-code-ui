/**
 * useProjects Hook Tests
 *
 * Tests for the useProjects custom hook:
 * - Initial project state (empty, with initial projects)
 * - Sort order management (persisted to localStorage)
 * - Project refresh (success and error cases)
 * - Create project (success and error cases)
 * - Rename project (local state update)
 * - Delete project (local state removal)
 * - updateSessionSummary (optimistic update across session arrays)
 * - getSortedProjects (starred priority, name/recent sorting)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock shared services (heavy dependency chain)
vi.mock('@/shared/services', () => ({
  api: {},
}));

// Mock sidebar service
const mockSidebarService = {
  getProjects: vi.fn(),
  createProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
};

vi.mock('@/features/sidebar/services', () => ({
  getSidebarService: () => mockSidebarService,
}));

// Mock shared utils barrel export
vi.mock('@/shared/utils', () => ({
  requestDeduplicator: {
    dedupe: vi.fn((_key: string, fn: () => Promise<void>) => fn()),
  },
}));

// Mock logger
vi.mock('@/shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { useProjects } from '../useProjects';
import type { Project } from '../types';

const createProject = (
  name: string,
  overrides: Partial<Project> = {}
): Project => ({
  name,
  displayName: name,
  path: `/projects/${name}`,
  sessions: [],
  cursorSessions: [],
  codexSessions: [],
  ...overrides,
});

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockSidebarService.getProjects.mockResolvedValue([]);
    mockSidebarService.createProject.mockResolvedValue(
      createProject('new-project')
    );
    mockSidebarService.renameProject.mockResolvedValue(undefined);
    mockSidebarService.deleteProject.mockResolvedValue(undefined);
  });

  describe('Initial State', () => {
    it('should start with empty projects when none provided', () => {
      const { result } = renderHook(() => useProjects());

      expect(result.current.projects).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should accept initial projects', () => {
      const projects = [
        createProject('project-a'),
        createProject('project-b'),
      ];

      const { result } = renderHook(() => useProjects(projects));

      expect(result.current.projects).toEqual(projects);
    });

    it('should handle null initial projects', () => {
      const { result } = renderHook(() => useProjects(null));

      expect(result.current.projects).toEqual([]);
    });

    it('should handle undefined initial projects', () => {
      const { result } = renderHook(() => useProjects(undefined));

      expect(result.current.projects).toEqual([]);
    });
  });

  describe('Sort Order', () => {
    it('should default to name sort order', () => {
      const { result } = renderHook(() => useProjects());

      expect(result.current.sortOrder).toBe('name');
    });

    it('should load sort order from localStorage', () => {
      localStorage.setItem(
        'claude-settings',
        JSON.stringify({ projectSortOrder: 'recent' })
      );

      const { result } = renderHook(() => useProjects());

      expect(result.current.sortOrder).toBe('recent');
    });

    it('should update sort order and persist', () => {
      const { result } = renderHook(() => useProjects());

      act(() => {
        result.current.setSortOrder('recent');
      });

      expect(result.current.sortOrder).toBe('recent');

      const settings = JSON.parse(
        localStorage.getItem('claude-settings')!
      );
      expect(settings.projectSortOrder).toBe('recent');
    });

    it('should merge sort order into existing settings', () => {
      localStorage.setItem(
        'claude-settings',
        JSON.stringify({ otherSetting: true })
      );

      const { result } = renderHook(() => useProjects());

      act(() => {
        result.current.setSortOrder('recent');
      });

      const settings = JSON.parse(
        localStorage.getItem('claude-settings')!
      );
      expect(settings.otherSetting).toBe(true);
      expect(settings.projectSortOrder).toBe('recent');
    });
  });

  describe('refresh', () => {
    it('should fetch projects from service', async () => {
      const fetched = [
        createProject('project-a'),
        createProject('project-b'),
      ];
      mockSidebarService.getProjects.mockResolvedValue(fetched);

      const { result } = renderHook(() => useProjects());

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockSidebarService.getProjects).toHaveBeenCalled();
      expect(result.current.projects).toEqual(fetched);
    });

    it('should set loading state during refresh', async () => {
      let resolveRefresh: () => void;
      mockSidebarService.getProjects.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
      );

      const { result } = renderHook(() => useProjects());

      act(() => {
        result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveRefresh!();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle refresh error', async () => {
      mockSidebarService.getProjects.mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useProjects());

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('createProject', () => {
    it('should create a project and refresh', async () => {
      const newProject = createProject('new-project');
      mockSidebarService.createProject.mockResolvedValue(newProject);
      mockSidebarService.getProjects.mockResolvedValue([newProject]);

      const { result } = renderHook(() => useProjects());

      const created = await act(async () => {
        return await result.current.createProject('/path/to/project');
      });

      expect(mockSidebarService.createProject).toHaveBeenCalledWith(
        '/path/to/project'
      );
      expect(created).toEqual(newProject);
    });

    it('should set error when creation fails', async () => {
      mockSidebarService.createProject.mockRejectedValue(
        new Error('Project exists')
      );

      const { result } = renderHook(() => useProjects());

      await expect(
        act(async () => {
          await result.current.createProject('/path');
        })
      ).rejects.toThrow('Project exists');

      expect(result.current.error).toBe('Project exists');
    });
  });

  describe('renameProject', () => {
    it('should update local state with new display name', async () => {
      const projects = [createProject('old-name')];
      const { result } = renderHook(() => useProjects(projects));

      await act(async () => {
        await result.current.renameProject('old-name', 'New Name');
      });

      expect(mockSidebarService.renameProject).toHaveBeenCalledWith(
        'old-name',
        'New Name'
      );
      expect(result.current.projects[0].displayName).toBe('New Name');
    });

    it('should set error when rename fails', async () => {
      mockSidebarService.renameProject.mockRejectedValue(
        new Error('Rename failed')
      );

      const { result } = renderHook(() => useProjects());

      await expect(
        act(async () => {
          await result.current.renameProject('proj', 'new-name');
        })
      ).rejects.toThrow('Rename failed');

      expect(result.current.error).toBe('Rename failed');
    });
  });

  describe('deleteProject', () => {
    it('should remove project from local state', async () => {
      const projects = [
        createProject('project-a'),
        createProject('project-b'),
      ];
      const { result } = renderHook(() => useProjects(projects));

      await act(async () => {
        await result.current.deleteProject('project-a');
      });

      expect(mockSidebarService.deleteProject).toHaveBeenCalledWith(
        'project-a'
      );
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe('project-b');
    });

    it('should set error when deletion fails', async () => {
      mockSidebarService.deleteProject.mockRejectedValue(
        new Error('Cannot delete')
      );

      const { result } = renderHook(() => useProjects());

      await expect(
        act(async () => {
          await result.current.deleteProject('proj');
        })
      ).rejects.toThrow('Cannot delete');

      expect(result.current.error).toBe('Cannot delete');
    });
  });

  describe('updateSessionSummary', () => {
    it('should update session summary across all session arrays', () => {
      const project = createProject('my-project', {
        sessions: [{ id: 's1', summary: 'old summary' }],
        cursorSessions: [{ id: 's1', summary: 'old summary' }],
        codexSessions: [{ id: 's1', summary: 'old summary' }],
      });
      const otherProject = createProject('other-project', {
        sessions: [{ id: 's1', summary: 'unchanged' }],
      });

      const { result } = renderHook(() =>
        useProjects([project, otherProject])
      );

      act(() => {
        result.current.updateSessionSummary(
          'my-project',
          's1',
          'new summary'
        );
      });

      const myProject = result.current.projects.find(
        (p) => p.name === 'my-project'
      );
      expect(myProject?.sessions?.[0].summary).toBe('new summary');
      expect(myProject?.cursorSessions?.[0].summary).toBe('new summary');
      expect(myProject?.codexSessions?.[0].summary).toBe('new summary');

      // Other project should be unchanged
      const otherProj = result.current.projects.find(
        (p) => p.name === 'other-project'
      );
      expect(otherProj?.sessions?.[0].summary).toBe('unchanged');
    });

    it('should handle missing session arrays gracefully', () => {
      const project = createProject('my-project', {
        sessions: [{ id: 's1', summary: 'old' }],
        cursorSessions: undefined,
        codexSessions: undefined,
      });

      const { result } = renderHook(() => useProjects([project]));

      act(() => {
        result.current.updateSessionSummary('my-project', 's1', 'new');
      });

      const updated = result.current.projects[0];
      expect(updated.sessions?.[0].summary).toBe('new');
      expect(updated.cursorSessions).toBeUndefined();
      expect(updated.codexSessions).toBeUndefined();
    });
  });

  describe('getSortedProjects', () => {
    it('should sort by name alphabetically', () => {
      const projects = [
        createProject('charlie'),
        createProject('alpha'),
        createProject('bravo'),
      ];

      const { result } = renderHook(() => useProjects(projects));

      const sorted = result.current.getSortedProjects(new Set());
      expect(sorted.map((p) => p.name)).toEqual([
        'alpha',
        'bravo',
        'charlie',
      ]);
    });

    it('should sort starred projects first', () => {
      const projects = [
        createProject('alpha'),
        createProject('bravo'),
        createProject('charlie'),
      ];

      const { result } = renderHook(() => useProjects(projects));

      const sorted = result.current.getSortedProjects(new Set(['bravo']));
      expect(sorted.map((p) => p.name)).toEqual([
        'bravo',
        'alpha',
        'charlie',
      ]);
    });

    it('should sort by recent activity when order is recent', () => {
      const projects = [
        createProject('old', { lastActivity: '2024-01-01' }),
        createProject('new', { lastActivity: '2024-12-31' }),
        createProject('mid', { lastActivity: '2024-06-15' }),
      ];

      const { result } = renderHook(() => useProjects(projects));

      act(() => {
        result.current.setSortOrder('recent');
      });

      const sorted = result.current.getSortedProjects(new Set());
      expect(sorted.map((p) => p.name)).toEqual(['new', 'mid', 'old']);
    });

    it('should use displayName for sorting when available', () => {
      const projects = [
        createProject('z-project', { displayName: 'A Project' }),
        createProject('a-project', { displayName: 'Z Project' }),
      ];

      const { result } = renderHook(() => useProjects(projects));

      const sorted = result.current.getSortedProjects(new Set());
      expect(sorted[0].name).toBe('z-project'); // displayName 'A Project' comes first
    });

    it('should handle empty projects array', () => {
      const { result } = renderHook(() => useProjects([]));

      const sorted = result.current.getSortedProjects(new Set());
      expect(sorted).toEqual([]);
    });
  });
});
