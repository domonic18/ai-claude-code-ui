/**
 * useSettings Hook
 *
 * Custom hook for managing settings state and operations.
 * Provides a clean interface for components to interact with settings.
 */

import { useState, useCallback, useEffect } from 'react';
import { getSettingsService, type ClaudePermissions } from '../services/settingsService';
import type { McpServer } from '../types/settings.types';

export interface SettingsState {
  permissions: ClaudePermissions;
  mcpServers: McpServer[];
  loading: boolean;
  error: string | null;
}

export interface UseSettingsReturn {
  // State
  permissions: ClaudePermissions;
  mcpServers: McpServer[];
  loading: boolean;
  error: string | null;

  // Permissions operations
  loadPermissions: () => Promise<void>;
  updatePermissions: (data: ClaudePermissions) => Promise<{ success: boolean; message?: string }>;

  // MCP servers operations
  loadMcpServers: () => Promise<void>;
  createMcpServer: (server: Partial<McpServer>) => Promise<{ success: boolean; error?: string }>;
  updateMcpServer: (id: string, server: Partial<McpServer>) => Promise<{ success: boolean; error?: string }>;
  deleteMcpServer: (id: string) => Promise<{ success: boolean; error?: string }>;
  testMcpServer: (id: string) => Promise<{ success: boolean; message?: string }>;
  discoverMcpTools: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
}

/**
 * useSettings - Hook for managing settings state and operations
 */
export function useSettings(): UseSettingsReturn {
  const [permissions, setPermissions] = useState<ClaudePermissions>({
    skipPermissions: false,
    allowedTools: [],
    disallowedTools: []
  });
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = getSettingsService();

  // Load permissions
  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await service.getPermissions();
      setPermissions(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load permissions';
      setError(message);
      console.error('[useSettings] Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Update permissions
  const updatePermissionsCallback = useCallback(async (data: ClaudePermissions) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.updatePermissions(data);
      if (result.success) {
        setPermissions(data);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update permissions';
      setError(message);
      console.error('[useSettings] Error updating permissions:', err);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Load MCP servers
  const loadMcpServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const servers = await service.getMcpServers();
      setMcpServers(servers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load MCP servers';
      setError(message);
      console.error('[useSettings] Error loading MCP servers:', err);
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Create MCP server
  const createMcpServer = useCallback(async (server: Partial<McpServer>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.createMcpServer(server);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create MCP server';
      setError(message);
      console.error('[useSettings] Error creating MCP server:', err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [service, loadMcpServers]);

  // Update MCP server
  const updateMcpServer = useCallback(async (id: string, server: Partial<McpServer>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.updateMcpServer(id, server);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update MCP server';
      setError(message);
      console.error('[useSettings] Error updating MCP server:', err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [service, loadMcpServers]);

  // Delete MCP server
  const deleteMcpServer = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.deleteMcpServer(id);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete MCP server';
      setError(message);
      console.error('[useSettings] Error deleting MCP server:', err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [service, loadMcpServers]);

  // Test MCP server
  const testMcpServer = useCallback(async (id: string) => {
    try {
      setError(null);
      return await service.testMcpServer(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to test MCP server';
      setError(message);
      console.error('[useSettings] Error testing MCP server:', err);
      return { success: false, message };
    }
  }, [service]);

  // Discover MCP tools
  const discoverMcpTools = useCallback(async (id: string) => {
    try {
      setError(null);
      return await service.discoverMcpTools(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover MCP tools';
      setError(message);
      console.error('[useSettings] Error discovering MCP tools:', err);
      return { success: false, error: message };
    }
  }, [service]);

  return {
    // State
    permissions,
    mcpServers,
    loading,
    error,

    // Permissions operations
    loadPermissions,
    updatePermissions: updatePermissionsCallback,

    // MCP servers operations
    loadMcpServers,
    createMcpServer,
    updateMcpServer,
    deleteMcpServer,
    testMcpServer,
    discoverMcpTools
  };
}

export default useSettings;
