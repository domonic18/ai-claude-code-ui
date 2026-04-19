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
 */

import { useState, useCallback, useEffect } from 'react';
import { getSettingsService } from '../services/settingsService';
import { McpServer } from '../types/settings.types';
import { McpFormData } from '../components/agent/McpServerForm';
import { logger } from '@/shared/utils/logger';

/**
 * Create empty MCP form data structure
 * @returns {McpFormData} Empty form data with default values
 */
const createEmptyMcpFormData = (): McpFormData => ({
  name: '',
  type: 'stdio',
  scope: 'user',
  projectPath: '',
  importMode: 'form',
  jsonInput: '',
  config: {
    command: '',
    args: [],
    env: {},
    url: '',
    headers: {},
    timeout: 30000
  }
});

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
 * Custom hook to manage MCP servers
 * @returns {UseAgentMcpServersReturn} MCP server state and handlers
 */
export function useAgentMcpServers(): UseAgentMcpServersReturn {
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);
  const [mcpFormData, setMcpFormData] = useState<McpFormData>(createEmptyMcpFormData());
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpTestResults, setMcpTestResults] = useState<Record<string, any>>({});
  const [mcpServerTools, setMcpServerTools] = useState<Record<string, any>>({});
  const [mcpToolsLoading, setMcpToolsLoading] = useState<Record<string, boolean>>({});
  const [jsonValidationError, setJsonValidationError] = useState('');

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
   * Load MCP servers on mount
   */
  useEffect(() => {
    loadMcpServers();
  }, [loadMcpServers]);

  /**
   * Open MCP form for adding or editing a server
   * @param {McpServer | null} server - Server to edit, or null for new server
   */
  const openMcpForm = useCallback((server: McpServer | null = null) => {
    if (server) {
      setEditingMcpServer(server);
      setMcpFormData({
        name: server.name,
        type: server.type,
        scope: server.scope,
        projectPath: server.projectPath || '',
        config: { ...server.config },
        raw: server.raw,
        importMode: 'form',
        jsonInput: ''
      });
    } else {
      setEditingMcpServer(null);
      setMcpFormData(createEmptyMcpFormData());
    }
    setJsonValidationError('');
    setShowMcpForm(true);
  }, []);

  /**
   * Reset MCP form to initial state
   */
  const resetMcpForm = useCallback(() => {
    setShowMcpForm(false);
    setEditingMcpServer(null);
    setMcpFormData(createEmptyMcpFormData());
    setJsonValidationError('');
  }, []);

  /**
   * Update MCP config field
   * @param {string} key - Config field key
   * @param {any} value - Config field value
   */
  const updateMcpConfig = useCallback((key: string, value: any) => {
    setMcpFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  }, []);

  /**
   * Save MCP server (create or update)
   * @param {McpFormData} serverData - Server configuration data
   * @returns {Promise<boolean>} Success status
   */
  const saveMcpServer = useCallback(async (serverData: McpFormData) => {
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
  }, [editingMcpServer, loadMcpServers]);

  /**
   * Handle MCP form submission
   * @param {React.FormEvent} e - Form event
   */
  const handleMcpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const service = getSettingsService();
    setMcpLoading(true);

    try {
      if (mcpFormData.importMode === 'json') {
        const result = await service.validateMcpServer({
          name: mcpFormData.name,
          jsonConfig: mcpFormData.jsonInput,
          scope: mcpFormData.scope,
          projectPath: mcpFormData.projectPath
        });

        if (result.success) {
          await loadMcpServers();
          resetMcpForm();
        } else {
          throw new Error(result.error || 'Failed to add server via JSON');
        }
      } else {
        await saveMcpServer(mcpFormData);
        resetMcpForm();
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setMcpLoading(false);
    }
  }, [mcpFormData, loadMcpServers, resetMcpForm, saveMcpServer]);

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
    showMcpForm,
    editingMcpServer,
    mcpFormData,
    mcpLoading,
    mcpTestResults,
    mcpServerTools,
    mcpToolsLoading,
    jsonValidationError,
    openMcpForm,
    resetMcpForm,
    updateMcpConfig,
    handleMcpSubmit,
    handleMcpDelete,
    handleMcpTest,
    handleMcpToolsDiscovery,
    setMcpFormData,
    setJsonValidationError,
    loadMcpServers,
  };
}
