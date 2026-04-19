/**
 * useSettings Hook
 *
 * Custom hook for managing settings state and operations.
 * Provides a clean interface for components to interact with settings.
 */

import { useState, useCallback, useEffect } from 'react';
import { getSettingsService, type ClaudePermissions } from '../services/settingsService';
import type { McpServer } from '../types/settings.types';
import { logger } from '@/shared/utils/logger';

/**
 * Handle settings operations with consistent error handling
 */
async function handleSettingsOperation<T>(
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
    logger.error('[handleSettingsOperation]', err);
    throw err;
  } finally {
    setLoading(false);
  }
}

/**
 * Create permissions operations
 */
function createPermissionsOperations(
  service: ReturnType<typeof getSettingsService>,
  setPermissions: React.Dispatch<React.SetStateAction<ClaudePermissions>>,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  const loadPermissions = useCallback(async () => {
    const data = await handleSettingsOperation(
      () => service.getPermissions(),
      'Failed to load permissions',
      setLoading,
      setError
    );
    setPermissions(data);
  }, [service, setPermissions, setLoading, setError]);

  const updatePermissionsCallback = useCallback(async (data: ClaudePermissions) => {
    const result = await handleSettingsOperation(
      () => service.updatePermissions(data),
      'Failed to update permissions',
      setLoading,
      setError
    );
    if (result.success) {
      setPermissions(data);
    }
    return result;
  }, [service, setPermissions, setLoading, setError]);

  return {
    loadPermissions,
    updatePermissions: updatePermissionsCallback,
  };
}

/**
 * Create MCP server operations
 */
function createMcpServerOperations(
  service: ReturnType<typeof getSettingsService>,
  setMcpServers: React.Dispatch<React.SetStateAction<McpServer[]>>,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  const loadMcpServers = useCallback(async () => {
    const servers = await handleSettingsOperation(
      () => service.getMcpServers(),
      'Failed to load MCP servers',
      setLoading,
      setError
    );
    setMcpServers(servers);
  }, [service, setMcpServers, setLoading, setError]);

  const createMcpServer = useCallback(async (server: Partial<McpServer>) => {
    const result = await handleSettingsOperation(
      () => service.createMcpServer(server),
      'Failed to create MCP server',
      setLoading,
      setError
    );
    if (result.success) {
      await loadMcpServers();
    }
    return result;
  }, [service, loadMcpServers, setLoading, setError]);

  const updateMcpServer = useCallback(async (id: string, server: Partial<McpServer>) => {
    const result = await handleSettingsOperation(
      () => service.updateMcpServer(id, server),
      'Failed to update MCP server',
      setLoading,
      setError
    );
    if (result.success) {
      await loadMcpServers();
    }
    return result;
  }, [service, loadMcpServers, setLoading, setError]);

  const deleteMcpServer = useCallback(async (id: string) => {
    const result = await handleSettingsOperation(
      () => service.deleteMcpServer(id),
      'Failed to delete MCP server',
      setLoading,
      setError
    );
    if (result.success) {
      await loadMcpServers();
    }
    return result;
  }, [service, loadMcpServers, setLoading, setError]);

  const testMcpServer = useCallback(async (id: string) => {
    try {
      setError(null);
      return await service.testMcpServer(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to test MCP server';
      setError(message);
      logger.error('[useSettings] Error testing MCP server:', err);
      return { success: false, message };
    }
  }, [service, setError]);

  const discoverMcpTools = useCallback(async (id: string) => {
    try {
      setError(null);
      return await service.discoverMcpTools(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover MCP tools';
      setError(message);
      logger.error('[useSettings] Error discovering MCP tools:', err);
      return { success: false, error: message };
    }
  }, [service, setError]);

  return {
    loadMcpServers,
    createMcpServer,
    updateMcpServer,
    deleteMcpServer,
    testMcpServer,
    discoverMcpTools,
  };
}

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

  // Create permissions operations
  const permissionsOps = createPermissionsOperations(
    service,
    setPermissions,
    setLoading,
    setError
  );

  // Create MCP server operations
  const mcpOps = createMcpServerOperations(
    service,
    setMcpServers,
    setLoading,
    setError
  );

  return {
    // State
    permissions,
    mcpServers,
    loading,
    error,

    // Permissions operations
    ...permissionsOps,

    // MCP servers operations
    ...mcpOps,
  };
}

export default useSettings;
