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
// 统一处理设置操作的错误处理函数
async function handleSettingsOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
): Promise<T> {
  try {
    // 开始加载，清空错误
    setLoading(true);
    setError(null);
    return await operation();
  } catch (err) {
    // 捕获错误并设置错误信息
    const message = err instanceof Error ? err.message : errorMessage;
    setError(message);
    logger.error('[handleSettingsOperation]', err);
    throw err;
  } finally {
    // 无论成功失败都结束加载状态
    setLoading(false);
  }
}

/**
 * Create permissions operations
 */
// 创建权限相关操作函数（加载和更新）
function createPermissionsOperations(
  service: ReturnType<typeof getSettingsService>,
  setPermissions: React.Dispatch<React.SetStateAction<ClaudePermissions>>,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  // 加载权限设置
  const loadPermissions = useCallback(async () => {
    const data = await handleSettingsOperation(
      () => service.getPermissions(),
      'Failed to load permissions',
      setLoading,
      setError
    );
    setPermissions(data);
  }, [service, setPermissions, setLoading, setError]);

  // 更新权限设置
  const updatePermissionsCallback = useCallback(async (data: ClaudePermissions) => {
    const result = await handleSettingsOperation(
      () => service.updatePermissions(data),
      'Failed to update permissions',
      setLoading,
      setError
    );
    // 更新成功则刷新本地状态
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
// 创建 MCP 服务器增删改操作（操作后自动刷新列表）
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
    // 操作成功后重新加载服务器列表
    if (result.success) {
      await loadMcpServers();
    }
    return result;
  };
}

/**
 * Create MCP test/discover operation without reload
 */
// 创建 MCP 测试和工具发现操作（不自动刷新列表）
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
      // 捕获测试/发现操作的错误
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
// 创建 MCP 服务器操作集合（加载、创建、更新、删除、测试、发现工具）
function createMcpServerOperations(
  service: ReturnType<typeof getSettingsService>,
  setMcpServers: React.Dispatch<React.SetStateAction<McpServer[]>>,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  // 加载所有 MCP 服务器
  const loadMcpServers = useCallback(async () => {
    const servers = await handleSettingsOperation(
      () => service.getMcpServers(),
      'Failed to load MCP servers',
      setLoading,
      setError
    );
    setMcpServers(servers);
  }, [service, setMcpServers, setLoading, setError]);

  // 创建 CRUD 操作封装
  const crudOperation = createMcpCrudOperation(
    service,
    loadMcpServers,
    setLoading,
    setError
  );

  // 创建测试操作封装
  const testOperation = createMcpTestOperation(service, setError, 'Failed to test MCP server');
  // 创建工具发现操作封装
  const discoverOperation = createMcpTestOperation(service, setError, 'Failed to discover MCP tools');

  // 创建 MCP 服务器
  const createMcpServer = useCallback(async (server: Partial<McpServer>) => {
    return crudOperation(
      () => service.createMcpServer(server),
      'Failed to create MCP server'
    );
  }, [service, crudOperation]);

  // 更新 MCP 服务器
  const updateMcpServer = useCallback(async (id: string, server: Partial<McpServer>) => {
    return crudOperation(
      () => service.updateMcpServer(id, server),
      'Failed to update MCP server'
    );
  }, [service, crudOperation]);

  // 删除 MCP 服务器
  const deleteMcpServer = useCallback(async (id: string) => {
    return crudOperation(
      () => service.deleteMcpServer(id),
      'Failed to delete MCP server'
    );
  }, [service, crudOperation]);

  // 测试 MCP 服务器连接
  const testMcpServer = useCallback(async (id: string) => {
    return testOperation(id, service.testMcpServer.bind(service));
  }, [testOperation, service]);

  // 发现 MCP 工具
  const discoverMcpTools = useCallback(async (id: string) => {
    return discoverOperation(id, service.discoverMcpTools.bind(service));
  }, [discoverOperation, service]);

  return {
    // 返回所有 MCP 服务器操作
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
  // 初始化权限设置状态
  const [permissions, setPermissions] = useState<ClaudePermissions>({
    skipPermissions: false,
    allowedTools: [],
    disallowedTools: []
  });
  // MCP 服务器列表状态
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(false);
  // 错误信息
  const [error, setError] = useState<string | null>(null);

  // 获取设置服务实例
  const service = getSettingsService();

  // Create permissions operations
  // 创建权限操作集合
  const permissionsOps = createPermissionsOperations(
    service,
    setPermissions,
    setLoading,
    setError
  );

  // Create MCP server operations
  // 创建 MCP 服务器操作集合
  const mcpOps = createMcpServerOperations(
    service,
    setMcpServers,
    setLoading,
    setError
  );

  return {
    // State
    // 返回状态
    permissions,
    mcpServers,
    loading,
    error,

    // Permissions operations
    // 返回权限操作
    ...permissionsOps,

    // MCP servers operations
    // 返回 MCP 服务器操作
    ...mcpOps,
  };
}

export default useSettings;
