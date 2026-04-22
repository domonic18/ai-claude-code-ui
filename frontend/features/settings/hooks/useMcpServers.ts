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
// MCP 服务器操作的统一错误处理函数
async function handleMcpOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
): Promise<T> {
  try {
    // 开始加载状态
    setLoading(true);
    setError(null);
    return await operation();
  } catch (err) {
    // 捕获并记录错误
    const message = err instanceof Error ? err.message : errorMessage;
    setError(message);
    logger.error('[handleMcpOperation]', err);
    throw err;
  } finally {
    // 无论成功失败都结束加载状态
    setLoading(false);
  }
}

/**
 * Helper to clean up server-related data
 */
// 清理服务器相关数据的辅助函数（删除服务器时清理测试结果和工具缓存）
function cleanupServerData<T>(
  prev: Record<string, T>,
  serverId: string
): Record<string, T> {
  const updated = { ...prev };
  // 删除所有与该服务器相关的缓存数据
  Object.keys(updated).forEach(key => {
    if (key.endsWith(`-${serverId}`)) {
      delete updated[key];
    }
  });
  return updated;
}

/**
 * Create MCP server CRUD operations
 */
// 创建 MCP 服务器增删改查操作集合
function createMcpCrudOperations(
  service: ReturnType<typeof getSettingsService>,
  fetchServers: () => Promise<void>,
  setLoading: (loading: boolean) => void,
  setTestResults: React.Dispatch<React.SetStateAction<Record<string, { success: boolean; message?: string }>>>,
  setServerTools: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
) {
  // 创建 MCP 服务器
  const createServer = useCallback(async (server: Partial<McpServer>) => {
    const result = await handleMcpOperation(
      () => service.createMcpServer(server),
      'Failed to create MCP server',
      setLoading,
      setError
    );
    // 创建成功后刷新列表
    if (result.success) {
      await fetchServers();
    }
    return result;
  }, [service, fetchServers, setLoading, setError]);

  // 更新 MCP 服务器
  const updateServer = useCallback(async (id: string, server: Partial<McpServer>) => {
    const result = await handleMcpOperation(
      () => service.updateMcpServer(id, server),
      'Failed to update MCP server',
      setLoading,
      setError
    );
    // 更新成功后刷新列表
    if (result.success) {
      await fetchServers();
    }
    return result;
  }, [service, fetchServers, setLoading, setError]);

  // 删除 MCP 服务器
  const deleteServer = useCallback(async (id: string) => {
    const result = await handleMcpOperation(
      () => service.deleteMcpServer(id),
      'Failed to delete MCP server',
      setLoading,
      setError
    );
    // 删除成功后刷新列表并清理缓存
    if (result.success) {
      await fetchServers();
      // 清理该服务器的测试结果缓存
      setTestResults(prev => cleanupServerData(prev, id));
      // 清理该服务器的工具列表缓存
      setServerTools(prev => cleanupServerData(prev, id));
    }
    return result;
  }, [service, fetchServers, setLoading, setTestResults, setServerTools, setError]);

  // 测试 MCP 服务器连接
  const testServer = useCallback(async (id: string) => {
    try {
      setError(null);
      const result = await service.testMcpServer(id);
      // 保存测试结果到缓存
      setTestResults(prev => ({ ...prev, [id]: result }));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to test MCP server';
      setError(message);
      return { success: false, message };
    }
  }, [service, setTestResults, setError]);

  return {
    // 返回所有 CRUD 操作
    createServer,
    updateServer,
    deleteServer,
    testServer,
  };
}

/**
 * Create discover tools operation with loading state
 */
// 创建 MCP 工具发现操作（带加载状态）
function createDiscoverToolsOperation(
  service: ReturnType<typeof getSettingsService>,
  setServerTools: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  setToolsLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
) {
  return useCallback(async (id: string) => {
    try {
      setError(null);
      // 开始加载工具列表
      setToolsLoading(prev => ({ ...prev, [id]: true }));
      const result = await service.discoverMcpTools(id);
      // 保存工具列表到缓存
      if (result.success) {
        setServerTools(prev => ({ ...prev, [id]: result.data }));
      }
      return result;
    } catch (err) {
      // 发现工具失败
      const message = err instanceof Error ? err.message : 'Failed to discover MCP tools';
      setError(message);
      return { success: false, error: message };
    } finally {
      // 结束加载状态
      setToolsLoading(prev => ({ ...prev, [id]: false }));
    }
  }, [service, setServerTools, setToolsLoading, setError]);
}

/**
 * Create helper functions
 */
// 创建辅助函数（根据ID获取服务器、清除错误）
function createHelperFunctions(
  servers: McpServer[],
  setError: React.Dispatch<React.SetStateAction<string | null>>
) {
  // 根据服务器ID查找服务器对象
  const getServerById = useCallback((id: string): McpServer | undefined => {
    return servers.find(s => s.id === id);
  }, [servers]);

  // 清除错误信息
  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    getServerById,
    clearError,
  };
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

// 由组件调用，自定义 Hook：useMcpServers
/**
 * useMcpServers - Hook for managing MCP server state and operations
 */
export function useMcpServers(): UseMcpServersReturn {
  // MCP 服务器列表状态
  const [servers, setServers] = useState<McpServer[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(false);
  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // 测试结果缓存（按服务器ID存储）
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message?: string }>>({});
  // 服务器工具列表缓存（按服务器ID存储）
  const [serverTools, setServerTools] = useState<Record<string, any>>({});
  // 工具发现加载状态（按服务器ID存储）
  const [toolsLoading, setToolsLoading] = useState<Record<string, boolean>>({});

  // 获取设置服务实例
  const service = getSettingsService();

  // Fetch all servers
  // 加载所有 MCP 服务器
  const fetchServers = useCallback(async () => {
    const data = await handleMcpOperation(
      () => service.getMcpServers(),
      'Failed to fetch MCP servers',
      setLoading,
      setError
    );
    setServers(data);
  }, [service]);

  // Create CRUD operations
  // 创建增删改查操作集合
  const crudOperations = createMcpCrudOperations(
    service,
    fetchServers,
    setLoading,
    setTestResults,
    setServerTools,
    setError
  );

  // Create discover tools operation
  // 创建工具发现操作
  const discoverTools = createDiscoverToolsOperation(
    service,
    setServerTools,
    setToolsLoading,
    setError
  );

  // Create helper functions
  // 创建辅助函数
  const helpers = createHelperFunctions(servers, setError);

  return {
    // State
    // 返回所有状态
    servers,
    loading,
    error,
    testResults,
    serverTools,
    toolsLoading,

    // Operations
    // 返回所有操作
    fetchServers,
    ...crudOperations,
    discoverTools,

    // Helpers
    // 返回辅助函数
    ...helpers,
  };
}

export default useMcpServers;
