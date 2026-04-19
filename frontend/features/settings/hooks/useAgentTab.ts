/**
 * useAgentTab Hook
 *
 * Custom hook that manages all state and business logic for the AgentTab component.
 * Extracted to reduce component size and improve testability.
 *
 * Features:
 * - Agent and category selection state
 * - Claude permissions management
 * - MCP server CRUD operations
 * - MCP server testing and tools discovery
 */

import { useState, useEffect, useImperativeHandle } from 'react';
import { getSettingsService } from '../services/settingsService';
import { McpServer } from '../types/settings.types';
import { logger } from '@/shared/utils/logger';
import { McpFormData } from '../components/agent/McpServerForm';
import { CategoryType } from '../components/common/CategoryTabs';

type AgentType = 'claude' | 'opencode';

export interface AgentTabHandle {
  savePermissions: () => void;
}

export interface UseAgentTabReturn {
  // State
  selectedAgent: AgentType;
  setSelectedAgent: (agent: AgentType) => void;
  selectedCategory: CategoryType;
  setSelectedCategory: (category: CategoryType) => void;

  // Claude Permissions
  skipPermissions: boolean;
  setSkipPermissions: (value: boolean) => void;
  allowedTools: string[];
  setAllowedTools: (tools: string[]) => void;
  disallowedTools: string[];
  setDisallowedTools: (tools: string[]) => void;
  newAllowedTool: string;
  setNewAllowedTool: (tool: string) => void;
  newDisallowedTool: string;
  setNewDisallowedTool: (tool: string) => void;

  // MCP Servers
  mcpServers: McpServer[];
  projects: any[];
  showMcpForm: boolean;
  editingMcpServer: McpServer | null;
  mcpFormData: McpFormData;
  mcpLoading: boolean;
  mcpTestResults: Record<string, any>;
  mcpServerTools: Record<string, any>;
  mcpToolsLoading: Record<string, boolean>;
  jsonValidationError: string;

  // Handlers
  openMcpForm: (server?: McpServer | null) => void;
  resetMcpForm: () => void;
  updateMcpConfig: (key: string, value: any) => void;
  handleMcpSubmit: (e: React.FormEvent) => Promise<void>;
  handleMcpDelete: (serverId: string) => Promise<void>;
  handleMcpTest: (serverId: string, scope: string) => Promise<void>;
  handleMcpToolsDiscovery: (serverId: string, scope: string) => Promise<void>;
  setMcpFormData: (data: McpFormData) => void;
  setJsonValidationError: (error: string) => void;
}

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

/**
 * Custom hook to manage AgentTab state and logic
 */
export const useAgentTab = (ref: React.Ref<AgentTabHandle>): UseAgentTabReturn => {
  // ===== Agent Selection State =====
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('claude');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('permissions');

  // ===== Claude-specific States =====
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');

  // ===== MCP Server States (Claude) =====
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [projects] = useState<any[]>([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);
  const [mcpFormData, setMcpFormData] = useState<McpFormData>(createEmptyMcpFormData());
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpTestResults, setMcpTestResults] = useState<Record<string, any>>({});
  const [mcpServerTools, setMcpServerTools] = useState<Record<string, any>>({});
  const [mcpToolsLoading, setMcpToolsLoading] = useState<Record<string, boolean>>({});
  const [jsonValidationError, setJsonValidationError] = useState('');

  // ===== Effects =====
  // Load initial settings
  useEffect(() => {
    loadAgentSettings();
  }, []);

  // Expose savePermissions method to parent via ref
  useImperativeHandle(ref, () => ({
    savePermissions: () => {
      savePermissions(skipPermissions, allowedTools, disallowedTools);
    }
  }));

  /**
   * Load agent settings including permissions and MCP servers
   */
  const loadAgentSettings = async () => {
    const service = getSettingsService();

    try {
      // Load Claude permissions using settingsService
      const permissions = await service.getPermissions();
      setSkipPermissions(permissions.skipPermissions || false);
      setAllowedTools(permissions.allowedTools || []);
      setDisallowedTools(permissions.disallowedTools || []);

      // Load MCP servers
      loadMcpServers();
    } catch (error) {
      logger.error('[AgentTab] Error loading agent settings:', error);
    }
  };

  /**
   * Load MCP servers from settings
   */
  const loadMcpServers = async () => {
    const service = getSettingsService();

    try {
      const servers = await service.getMcpServers();
      setMcpServers(servers);
    } catch (error) {
      logger.error('[AgentTab] Error loading MCP servers:', error);
      setMcpServers([]);
    }
  };

  /**
   * Save permissions settings
   */
  const savePermissions = async (
    currentSkipPermissions: boolean,
    currentAllowedTools: string[],
    currentDisallowedTools: string[]
  ) => {
    const service = getSettingsService();

    try {
      const result = await service.updatePermissions({
        skipPermissions: currentSkipPermissions,
        allowedTools: currentAllowedTools,
        disallowedTools: currentDisallowedTools,
      });

      if (result.success) {
        logger.info('[AgentTab] Permissions saved successfully:', result.message);
      } else {
        logger.error('[AgentTab] Failed to save permissions');
      }
    } catch (error) {
      logger.error('[AgentTab] Error saving permissions:', error);
    }
  };

  /**
   * Open MCP form for adding or editing a server
   */
  const openMcpForm = (server: McpServer | null = null) => {
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
  };

  /**
   * Reset MCP form to initial state
   */
  const resetMcpForm = () => {
    setShowMcpForm(false);
    setEditingMcpServer(null);
    setMcpFormData(createEmptyMcpFormData());
    setJsonValidationError('');
  };

  /**
   * Update MCP config field
   */
  const updateMcpConfig = (key: string, value: any) => {
    setMcpFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

  /**
   * Save MCP server (create or update)
   */
  const saveMcpServer = async (serverData: McpFormData) => {
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
      logger.error('[AgentTab] Error saving MCP server:', error);
      throw error;
    }
  };

  /**
   * Handle MCP form submission
   */
  const handleMcpSubmit = async (e: React.FormEvent) => {
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
  };

  /**
   * Handle MCP server deletion
   */
  const handleMcpDelete = async (serverId: string) => {
    const service = getSettingsService();

    try {
      const result = await service.deleteMcpServer(serverId);
      if (result.success) {
        await loadMcpServers();
      } else {
        logger.error('[AgentTab] Failed to delete server:', result.error);
      }
    } catch (error) {
      logger.error('[AgentTab] Error deleting MCP server:', error);
    }
  };

  /**
   * Handle MCP server connection test
   */
  const handleMcpTest = async (serverId: string, scope: string) => {
    const service = getSettingsService();

    try {
      const result = await service.testMcpServer(serverId);
      setMcpTestResults(prev => ({
        ...prev,
        [`${scope}-${serverId}`]: result
      }));
    } catch (error) {
      logger.error('[AgentTab] Error testing MCP server:', error);
    }
  };

  /**
   * Handle MCP tools discovery
   */
  const handleMcpToolsDiscovery = async (serverId: string, scope: string) => {
    const service = getSettingsService();

    setMcpToolsLoading(prev => ({ ...prev, [`${scope}-${serverId}`]: true }));
    try {
      const result = await service.discoverMcpTools(serverId);
      if (result.success) {
        setMcpServerTools(prev => ({
          ...prev,
          [`${scope}-${serverId}`]: result.data
        }));
      }
    } catch (error) {
      logger.error('[AgentTab] Error discovering MCP tools:', error);
    } finally {
      setMcpToolsLoading(prev => ({ ...prev, [`${scope}-${serverId}`]: false }));
    }
  };

  return {
    // State
    selectedAgent,
    setSelectedAgent,
    selectedCategory,
    setSelectedCategory,
    skipPermissions,
    setSkipPermissions,
    allowedTools,
    setAllowedTools,
    disallowedTools,
    setDisallowedTools,
    newAllowedTool,
    setNewAllowedTool,
    newDisallowedTool,
    setNewDisallowedTool,
    mcpServers,
    projects,
    showMcpForm,
    editingMcpServer,
    mcpFormData,
    mcpLoading,
    mcpTestResults,
    mcpServerTools,
    mcpToolsLoading,
    jsonValidationError,

    // Handlers
    openMcpForm,
    resetMcpForm,
    updateMcpConfig,
    handleMcpSubmit,
    handleMcpDelete,
    handleMcpTest,
    handleMcpToolsDiscovery,
    setMcpFormData,
    setJsonValidationError
  };
};
