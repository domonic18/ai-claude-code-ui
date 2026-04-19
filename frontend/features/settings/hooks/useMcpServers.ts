/**
 * useMcpServers Hook
 *
 * Custom hook specifically for managing MCP server state and operations.
 * Provides a focused interface for MCP server management.
 */

import { useState, useCallback, useEffect } from 'react';
import { getSettingsService } from '../services/settingsService';
import type { McpServer } from '../types/settings.types';
import { logger } from '@/shared/utils/logger';

/**
 * Helper function to handle MCP server operations with error handling
 */
async function handleMcpOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
): Promise<T> {
  try {
    setLoading(true);
    setError(null);
    return await operation();
  } catch (err) {
    const message = err instanceof Error ? err.message : errorMessage;
    setError(message);
    logger.error('[handleMcpOperation]', err);
    throw err;
  } finally {
    setLoading(false);
  }
}

/**
 * Helper to clean up server-related data
 */
function cleanupServerData<T>(
  prev: Record<string, T>,
  serverId: string
): Record<string, T> {
  const updated = { ...prev };
  Object.keys(updated).forEach(key => {
    if (key.endsWith(`-${serverId}`)) {
      delete updated[key];
    }
  });
  return updated;
}

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
    const data = await handleMcpOperation(
      () => service.getMcpServers(),
      'Failed to fetch MCP servers',
      setLoading,
      setError
    );
    setServers(data);
  }, [service]);

  // Create server
  const createServer = useCallback(async (server: Partial<McpServer>) => {
    const result = await handleMcpOperation(
      () => service.createMcpServer(server),
      'Failed to create MCP server',
      setLoading,
      setError
    );
    if (result.success) {
      await fetchServers();
    }
    return result;
  }, [service, fetchServers]);

  // Update server
  const updateServer = useCallback(async (id: string, server: Partial<McpServer>) => {
    const result = await handleMcpOperation(
      () => service.updateMcpServer(id, server),
      'Failed to update MCP server',
      setLoading,
      setError
    );
    if (result.success) {
      await fetchServers();
    }
    return result;
  }, [service, fetchServers]);

  // Delete server
  const deleteServer = useCallback(async (id: string) => {
    const result = await handleMcpOperation(
      () => service.deleteMcpServer(id),
      'Failed to delete MCP server',
      setLoading,
      setError
    );
    if (result.success) {
      await fetchServers();
      setTestResults(prev => cleanupServerData(prev, id));
      setServerTools(prev => cleanupServerData(prev, id));
    }
    return result;
  }, [service, fetchServers]);

  // Test server
  const testServer = useCallback(async (id: string) => {
    try {
      setError(null);
      const result = await service.testMcpServer(id);
      setTestResults(prev => ({ ...prev, [id]: result }));
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
      if (result.success) {
        setServerTools(prev => ({ ...prev, [id]: result.data }));
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
