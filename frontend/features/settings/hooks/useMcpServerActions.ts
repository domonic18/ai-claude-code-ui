/**
 * useMcpServerActions Hook
 *
 * Custom hook that manages MCP server CRUD operations.
 * Extracted from useAgentMcpServers to improve modularity.
 *
 * Features:
 * - Load servers from settings service
 * - Delete MCP servers
 * - Test MCP server connections
 * - Discover MCP tools
 */

import { useState, useCallback } from 'react';
import { getSettingsService } from '../services/settingsService';
import { McpServer } from '../types/settings.types';
import { logger } from '@/shared/utils/logger';

export interface UseMcpServerActionsReturn {
  mcpServers: McpServer[];
  mcpTestResults: Record<string, any>;
  mcpServerTools: Record<string, any>;
  mcpToolsLoading: Record<string, boolean>;
  loadMcpServers: () => Promise<void>;
  handleMcpDelete: (serverId: string) => Promise<void>;
  handleMcpTest: (serverId: string, scope: string) => Promise<void>;
  handleMcpToolsDiscovery: (serverId: string, scope: string) => Promise<void>;
}

/**
 * Custom hook to manage MCP server CRUD operations
 * @returns {UseMcpServerActionsReturn} Server state and action handlers
 */
export function useMcpServerActions(): UseMcpServerActionsReturn {
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [mcpTestResults, setMcpTestResults] = useState<Record<string, any>>({});
  const [mcpServerTools, setMcpServerTools] = useState<Record<string, any>>({});
  const [mcpToolsLoading, setMcpToolsLoading] = useState<Record<string, boolean>>({});

  /**
   * Load MCP servers from settings service
   */
  const loadMcpServers = useCallback(async () => {
    try {
      const service = getSettingsService();
      const servers = await service.getMcpServers();
      setMcpServers(servers);
    } catch (error) {
      logger.error('[AgentMcpServers] Error loading MCP servers:', error);
      setMcpServers([]);
    }
  }, []);

  /**
   * Handle MCP server deletion
   * @param {string} serverId - Server ID to delete
   */
  const handleMcpDelete = useCallback(async (serverId: string) => {
    try {
      const service = getSettingsService();
      const result = await service.deleteMcpServer(serverId);

      if (result.success) {
        await loadMcpServers();
      } else {
        logger.error('[AgentMcpServers] Failed to delete server:', result.error);
      }
    } catch (error) {
      logger.error('[AgentMcpServers] Error deleting MCP server:', error);
    }
  }, [loadMcpServers]);

  /**
   * Handle MCP server connection test
   * @param {string} serverId - Server ID to test
   * @param {string} scope - Server scope
   */
  const handleMcpTest = useCallback(async (serverId: string, scope: string) => {
    try {
      const service = getSettingsService();
      const result = await service.testMcpServer(serverId);

      setMcpTestResults(prev => ({
        ...prev,
        [`${scope}-${serverId}`]: result
      }));
    } catch (error) {
      logger.error('[AgentMcpServers] Error testing MCP server:', error);
    }
  }, []);

  /**
   * Handle MCP tools discovery
   * @param {string} serverId - Server ID to discover tools for
   * @param {string} scope - Server scope
   */
  const handleMcpToolsDiscovery = useCallback(async (serverId: string, scope: string) => {
    setMcpToolsLoading(prev => ({ ...prev, [`${scope}-${serverId}`]: true }));

    try {
      const service = getSettingsService();
      const result = await service.discoverMcpTools(serverId);

      if (result.success) {
        setMcpServerTools(prev => ({
          ...prev,
          [`${scope}-${serverId}`]: result.data
        }));
      }
    } catch (error) {
      logger.error('[AgentMcpServers] Error discovering MCP tools:', error);
    } finally {
      setMcpToolsLoading(prev => ({ ...prev, [`${scope}-${serverId}`]: false }));
    }
  }, []);

  return {
    mcpServers,
    mcpTestResults,
    mcpServerTools,
    mcpToolsLoading,
    loadMcpServers,
    handleMcpDelete,
    handleMcpTest,
    handleMcpToolsDiscovery
  };
}
