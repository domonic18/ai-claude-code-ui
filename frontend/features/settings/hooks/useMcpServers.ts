/**
 * useMcpServers Hook
 *
 * Custom hook specifically for managing MCP server state and operations.
 * Provides a focused interface for MCP server management.
 */

import { useState, useCallback, useEffect } from 'react';
import { getSettingsService } from '../services/settingsService';
import type { McpServer } from '../types/settings.types';

export interface McpServerState {
  servers: McpServer[];
  loading: boolean;
  error: string | null;
  testResults: Record<string, { success: boolean; message?: string }>;
  serverTools: Record<string, any>;
  toolsLoading: Record<string, boolean>;
}

export interface UseMcpServersReturn {
  // State
  servers: McpServer[];
  loading: boolean;
  error: string | null;
  testResults: Record<string, { success: boolean; message?: string }>;
  serverTools: Record<string, any>;
  toolsLoading: Record<string, boolean>;

  // Operations
  fetchServers: () => Promise<void>;
  createServer: (server: Partial<McpServer>) => Promise<{ success: boolean; error?: string }>;
  updateServer: (id: string, server: Partial<McpServer>) => Promise<{ success: boolean; error?: string }>;
  deleteServer: (id: string) => Promise<{ success: boolean; error?: string }>;
  testServer: (id: string) => Promise<{ success: boolean; message?: string }>;
  discoverTools: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Helpers
  getServerById: (id: string) => McpServer | undefined;
  clearError: () => void;
}

/**
 * useMcpServers - Hook for managing MCP server state and operations
 */
export function useMcpServers(): UseMcpServersReturn {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message?: string }>>({});
  const [serverTools, setServerTools] = useState<Record<string, any>>({});
  const [toolsLoading, setToolsLoading] = useState<Record<string, boolean>>({});

  const service = getSettingsService();

  // Fetch all servers
  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await service.getMcpServers();
      setServers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch MCP servers';
      setError(message);
      console.error('[useMcpServers] Error fetching servers:', err);
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Create server
  const createServer = useCallback(async (server: Partial<McpServer>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.createMcpServer(server);
      if (result.success) {
        await fetchServers();
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create MCP server';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [service, fetchServers]);

  // Update server
  const updateServer = useCallback(async (id: string, server: Partial<McpServer>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.updateMcpServer(id, server);
      if (result.success) {
        await fetchServers();
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update MCP server';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [service, fetchServers]);

  // Delete server
  const deleteServer = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await service.deleteMcpServer(id);
      if (result.success) {
        await fetchServers();
        // Clear test results and tools for deleted server
        setTestResults(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            if (key.endsWith(`-${id}`)) {
              delete updated[key];
            }
          });
          return updated;
        });
        setServerTools(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            if (key.endsWith(`-${id}`)) {
              delete updated[key];
            }
          });
          return updated;
        });
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete MCP server';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [service, fetchServers]);

  // Test server
  const testServer = useCallback(async (id: string) => {
    try {
      setError(null);
      const result = await service.testMcpServer(id);
      // Store test result by server ID
      setTestResults(prev => ({
        ...prev,
        [id]: result
      }));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to test MCP server';
      setError(message);
      return { success: false, message };
    }
  }, [service]);

  // Discover tools
  const discoverTools = useCallback(async (id: string) => {
    try {
      setError(null);
      setToolsLoading(prev => ({ ...prev, [id]: true }));
      const result = await service.discoverMcpTools(id);
      // Store tools data by server ID
      if (result.success) {
        setServerTools(prev => ({
          ...prev,
          [id]: result.data
        }));
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover MCP tools';
      setError(message);
      return { success: false, error: message };
    } finally {
      setToolsLoading(prev => ({ ...prev, [id]: false }));
    }
  }, [service]);

  // Get server by ID
  const getServerById = useCallback((id: string): McpServer | undefined => {
    return servers.find(s => s.id === id);
  }, [servers]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    servers,
    loading,
    error,
    testResults,
    serverTools,
    toolsLoading,

    // Operations
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    testServer,
    discoverTools,

    // Helpers
    getServerById,
    clearError
  };
}

export default useMcpServers;
