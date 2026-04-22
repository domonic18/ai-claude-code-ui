import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../useSettings';

vi.mock('@/shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

const mockGetPermissions = vi.fn();
const mockUpdatePermissions = vi.fn();
const mockGetMcpServers = vi.fn();
const mockCreateMcpServer = vi.fn();
const mockUpdateMcpServer = vi.fn();
const mockDeleteMcpServer = vi.fn();
const mockTestMcpServer = vi.fn();
const mockDiscoverMcpTools = vi.fn();

const mockService = {
  getPermissions: mockGetPermissions,
  updatePermissions: mockUpdatePermissions,
  getMcpServers: mockGetMcpServers,
  createMcpServer: mockCreateMcpServer,
  updateMcpServer: mockUpdateMcpServer,
  deleteMcpServer: mockDeleteMcpServer,
  testMcpServer: mockTestMcpServer,
  discoverMcpTools: mockDiscoverMcpTools,
};

vi.mock('../../services/settingsService', () => ({
  getSettingsService: () => mockService
}));

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.permissions).toEqual({
      skipPermissions: false,
      allowedTools: [],
      disallowedTools: []
    });
    expect(result.current.mcpServers).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('loadPermissions', () => {
    it('should load permissions successfully', async () => {
      const mockData = {
        skipPermissions: true,
        allowedTools: ['Read', 'Write'],
        disallowedTools: ['Bash']
      };
      mockGetPermissions.mockResolvedValue(mockData);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.loadPermissions();
      });

      expect(result.current.permissions).toEqual(mockData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle load permissions error', async () => {
      mockGetPermissions.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.loadPermissions().catch(() => {});
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });

    it('should handle non-Error exceptions', async () => {
      mockGetPermissions.mockRejectedValue('string error');

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.loadPermissions().catch(() => {});
      });

      expect(result.current.error).toBe('Failed to load permissions');
    });
  });

  describe('updatePermissions', () => {
    it('should update permissions successfully', async () => {
      const newData = {
        skipPermissions: false,
        allowedTools: ['Read'],
        disallowedTools: []
      };
      mockUpdatePermissions.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useSettings());

      const updateResult = await act(async () => {
        return await result.current.updatePermissions(newData);
      });

      expect(updateResult.success).toBe(true);
      expect(result.current.permissions).toEqual(newData);
    });

    it('should handle update permissions error', async () => {
      mockUpdatePermissions.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useSettings());

      const updateResult = await act(async () => {
        return await result.current.updatePermissions({
          skipPermissions: false,
          allowedTools: [],
          disallowedTools: []
        }).catch((err) => err);
      });

      expect(updateResult instanceof Error || updateResult?.success === false).toBe(true);
      expect(result.current.error).toBe('Update failed');
    });
  });

  describe('loadMcpServers', () => {
    it('should load MCP servers successfully', async () => {
      const mockServers = [
        { id: '1', name: 'Server 1', type: 'stdio', scope: 'project', enabled: true, config: {} }
      ];
      mockGetMcpServers.mockResolvedValue(mockServers);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.loadMcpServers();
      });

      expect(result.current.mcpServers).toEqual(mockServers);
      expect(result.current.loading).toBe(false);
    });

    it('should handle load MCP servers error', async () => {
      mockGetMcpServers.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.loadMcpServers().catch(() => {});
      });

      expect(result.current.error).toBe('Server error');
    });
  });

  describe('createMcpServer', () => {
    it('should create MCP server and reload list', async () => {
      const newServer = { name: 'New Server', type: 'stdio' as const, scope: 'project' as const, config: { command: 'node' } };
      mockCreateMcpServer.mockResolvedValue({ success: true });
      mockGetMcpServers.mockResolvedValue([]);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.createMcpServer(newServer);
      });

      expect(mockCreateMcpServer).toHaveBeenCalledWith(newServer);
      expect(mockGetMcpServers).toHaveBeenCalled();
    });

    it('should handle create MCP server error', async () => {
      mockCreateMcpServer.mockRejectedValue(new Error('Create failed'));

      const { result } = renderHook(() => useSettings());

      const res = await act(async () => {
        return await result.current.createMcpServer({
          name: 'Bad',
          type: 'stdio',
          scope: 'project',
          config: {}
        }).catch((err) => err);
      });

      expect(res instanceof Error || res?.success === false).toBe(true);
    });

    it('should not reload servers if create fails', async () => {
      mockCreateMcpServer.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.createMcpServer({
          name: 'Bad',
          type: 'stdio',
          scope: 'project',
          config: {}
        });
      });

      expect(mockGetMcpServers).not.toHaveBeenCalled();
    });
  });

  describe('updateMcpServer', () => {
    it('should update MCP server and reload list', async () => {
      mockUpdateMcpServer.mockResolvedValue({ success: true });
      mockGetMcpServers.mockResolvedValue([]);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.updateMcpServer('server-1', { name: 'Updated' });
      });

      expect(mockUpdateMcpServer).toHaveBeenCalledWith('server-1', { name: 'Updated' });
      expect(mockGetMcpServers).toHaveBeenCalled();
    });

    it('should handle update MCP server error', async () => {
      mockUpdateMcpServer.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useSettings());

      const res = await act(async () => {
        return await result.current.updateMcpServer('server-1', { name: 'Updated' }).catch((err) => err);
      });

      expect(res instanceof Error || res?.success === false).toBe(true);
    });
  });

  describe('deleteMcpServer', () => {
    it('should delete MCP server and reload list', async () => {
      mockDeleteMcpServer.mockResolvedValue({ success: true });
      mockGetMcpServers.mockResolvedValue([]);

      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.deleteMcpServer('server-1');
      });

      expect(mockDeleteMcpServer).toHaveBeenCalledWith('server-1');
      expect(mockGetMcpServers).toHaveBeenCalled();
    });

    it('should handle delete MCP server error', async () => {
      mockDeleteMcpServer.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useSettings());

      const res = await act(async () => {
        return await result.current.deleteMcpServer('server-1').catch((err) => err);
      });

      expect(res instanceof Error || res?.success === false).toBe(true);
    });
  });

  describe('testMcpServer', () => {
    it('should test MCP server successfully', async () => {
      mockTestMcpServer.mockResolvedValue({ success: true, message: 'Connection OK' });

      const { result } = renderHook(() => useSettings());

      const res = await act(async () => {
        return await result.current.testMcpServer('server-1');
      });

      expect(res).toEqual({ success: true, message: 'Connection OK' });
    });

    it('should handle test MCP server error', async () => {
      mockTestMcpServer.mockRejectedValue(new Error('Connection failed'));

      const { result } = renderHook(() => useSettings());

      const res = await act(async () => {
        return await result.current.testMcpServer('server-1');
      });

      expect(res.success).toBe(false);
    });
  });

  describe('discoverMcpTools', () => {
    it('should discover MCP tools successfully', async () => {
      const mockTools = ['tool1', 'tool2'];
      mockDiscoverMcpTools.mockResolvedValue({ success: true, data: mockTools });

      const { result } = renderHook(() => useSettings());

      const res = await act(async () => {
        return await result.current.discoverMcpTools('server-1');
      });

      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockTools);
    });

    it('should handle discover MCP tools error', async () => {
      mockDiscoverMcpTools.mockRejectedValue(new Error('Discovery failed'));

      const { result } = renderHook(() => useSettings());

      const res = await act(async () => {
        return await result.current.discoverMcpTools('server-1');
      });

      expect(res.success).toBe(false);
    });
  });
});
