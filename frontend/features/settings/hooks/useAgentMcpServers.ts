/**
 * useAgentMcpServers Hook
 *
 * Custom hook that manages MCP (Model Context Protocol) server state and CRUD operations.
 * Extracted from useAgentTab to improve modularity and maintainability.
 *
 * Features:
 * - MCP server state management
 * - Load servers from settings service
 * - Create, update, delete MCP servers
 * - Test MCP server connections
 * - Discover MCP tools
 *
 * Refactored into smaller sub-hooks:
 * - useMcpFormState: Form state management
 * - useMcpServerActions: Server CRUD operations
 */

import { useState, useCallback, useEffect } from 'react';
import { getSettingsService } from '../services/settingsService';
import { McpServer } from '../types/settings.types';
import { McpFormData } from '../components/agent/McpServerForm';
import { logger } from '@/shared/utils/logger';
import { useMcpFormState } from './useMcpFormState';
import { useMcpServerActions } from './useMcpServerActions';

export interface UseAgentMcpServersReturn {
  mcpServers: McpServer[];
  showMcpForm: boolean;
  editingMcpServer: McpServer | null;
  mcpFormData: McpFormData;
  mcpLoading: boolean;
  mcpTestResults: Record<string, any>;
  mcpServerTools: Record<string, any>;
  mcpToolsLoading: Record<string, boolean>;
  jsonValidationError: string;
  openMcpForm: (server?: McpServer | null) => void;
  resetMcpForm: () => void;
  updateMcpConfig: (key: string, value: any) => void;
  handleMcpSubmit: (e: React.FormEvent) => Promise<void>;
  handleMcpDelete: (serverId: string) => Promise<void>;
  handleMcpTest: (serverId: string, scope: string) => Promise<void>;
  handleMcpToolsDiscovery: (serverId: string, scope: string) => Promise<void>;
  setMcpFormData: (data: McpFormData) => void;
  setJsonValidationError: (error: string) => void;
  loadMcpServers: () => Promise<void>;
}

/**
 * Save MCP server (create or update)
 * @param {McpFormData} serverData - Server configuration data
 * @param {McpServer | null} editingMcpServer - Server being edited, or null for new server
 * @param {() => Promise<void>} loadMcpServers - Function to reload servers list
 * @returns {Promise<boolean>} Success status
 */
async function saveMcpServer(
  serverData: McpFormData,
  editingMcpServer: McpServer | null,
  loadMcpServers: () => Promise<void>
): Promise<boolean> {
  const service = getSettingsService();

  try {
    if (editingMcpServer) {
      const result = await service.updateMcpServer(editingMcpServer.id, {
        name: serverData.name,
        type: serverData.type,
        config: serverData.config,
        enabled: true
      });

      if (result.success) {
        await loadMcpServers();
        return true;
      } else {
        throw new Error(result.error || 'Failed to update server');
      }
    } else {
      const result = await service.createMcpServer({
        name: serverData.name,
        type: serverData.type,
        config: serverData.config
      });

      if (result.success) {
        await loadMcpServers();
        return true;
      } else {
        throw new Error(result.error || 'Failed to create server');
      }
    }
  } catch (error: any) {
    logger.error('[AgentMcpServers] Error saving MCP server:', error);
    throw error;
  }
}

/**
 * Custom hook to manage MCP servers
 * @returns {UseAgentMcpServersReturn} MCP server state and handlers
 */
export function useAgentMcpServers(): UseAgentMcpServersReturn {
  const formState = useMcpFormState();
  const serverActions = useMcpServerActions();
  const [mcpLoading, setMcpLoading] = useState(false);

  /**
   * Load MCP servers on mount
   */
  useEffect(() => {
    serverActions.loadMcpServers();
  }, [serverActions.loadMcpServers]);

  /**
   * Handle MCP form submission
   * @param {React.FormEvent} e - Form event
   */
  const handleMcpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const service = getSettingsService();
    setMcpLoading(true);

    try {
      if (formState.mcpFormData.importMode === 'json') {
        const result = await service.validateMcpServer({
          name: formState.mcpFormData.name,
          jsonConfig: formState.mcpFormData.jsonInput,
          scope: formState.mcpFormData.scope,
          projectPath: formState.mcpFormData.projectPath
        });

        if (result.success) {
          await serverActions.loadMcpServers();
          formState.resetMcpForm();
        } else {
          throw new Error(result.error || 'Failed to add server via JSON');
        }
      } else {
        await saveMcpServer(
          formState.mcpFormData,
          formState.editingMcpServer,
          serverActions.loadMcpServers
        );
        formState.resetMcpForm();
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setMcpLoading(false);
    }
  }, [formState, serverActions]);

  return {
    ...formState,
    ...serverActions,
    mcpLoading,
    handleMcpSubmit
  };
}
