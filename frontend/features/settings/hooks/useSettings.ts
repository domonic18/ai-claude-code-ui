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
 * Create MCP CRUD operation with reload
 */
function createMcpCrudOperation(
  service: ReturnType<typeof getSettingsService>,
  loadMcpServers: () => Promise<void>,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  return async (operation: () => Promise<any>, errorMessage: string) => {
    const result = await handleSettingsOperation(
      operation,
      errorMessage,
      setLoading,
      setError
    );
    if (result.success) {
      await loadMcpServers();
    }
    return result;
  };
}

/**
 * Create MCP test/discover operation without reload
 */
function createMcpTestOperation(
  service: ReturnType<typeof getSettingsService>,
  setError: (error: string | null) => void,
  errorMessage: string
) {
  return async (id: string, operation: (id: string) => Promise<any>) => {
    try {
      setError(null);
      return await operation(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : errorMessage;
      setError(message);
      logger.error('[useSettings] MCP operation error:', err);
      return { success: false, error: message, message };
    }
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

  const crudOperation = createMcpCrudOperation(
    service,
    loadMcpServers,
    setLoading,
    setError
  );

  const testOperation = createMcpTestOperation(service, setError, 'Failed to test MCP server');
  const discoverOperation = createMcpTestOperation(service, setError, 'Failed to discover MCP tools');

  const createMcpServer = useCallback(async (server: Partial<McpServer>) => {
    return crudOperation(
      () => service.createMcpServer(server),
      'Failed to create MCP server'
    );
  }, [service, crudOperation]);

  const updateMcpServer = useCallback(async (id: string, server: Partial<McpServer>) => {
    return crudOperation(
      () => service.updateMcpServer(id, server),
      'Failed to update MCP server'
    );
  }, [service, crudOperation]);

  const deleteMcpServer = useCallback(async (id: string) => {
    return crudOperation(
      () => service.deleteMcpServer(id),
      'Failed to delete MCP server'
    );
  }, [service, crudOperation]);

  const testMcpServer = useCallback(async (id: string) => {
    return testOperation(id, service.testMcpServer.bind(service));
  }, [testOperation, service]);

  const discoverMcpTools = useCallback(async (id: string) => {
    return discoverOperation(id, service.discoverMcpTools.bind(service));
  }, [discoverOperation, service]);

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

// 由组件调用，自定义 Hook：useSettings
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
