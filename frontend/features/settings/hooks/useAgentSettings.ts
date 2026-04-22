/**
 * useAgentSettings Hook
 *
 * Custom hook for managing agent-specific settings (Claude, Cursor, Codex).
 * Handles permissions, MCP servers, and agent configuration.
 */

import { useState, useCallback, useEffect } from 'react';
import { getSettingsService } from '../services/settingsService';
import type { AgentType, PermissionSettings, McpServer } from '../types/settings.types';
import { logger } from '@/shared/utils/logger';

export interface UseAgentSettingsParams {
  /** Selected agent type */
  agentType: AgentType;
}

export interface UseAgentSettingsReturn {
  // Permission settings
  allowedTools: string[];
  disallowedTools: string[];
  skipPermissions: boolean;
  setAllowedTools: (tools: string[]) => void;
  setDisallowedTools: (tools: string[]) => void;
  setSkipPermissions: (skip: boolean) => void;

  // MCP servers
  mcpServers: McpServer[];
  setMcpServers: (servers: McpServer[]) => void;

  // Form state
  newAllowedTool: string;
  setNewAllowedTool: (tool: string) => void;
  newDisallowedTool: string;
  setNewDisallowedTool: (tool: string) => void;

  // UI state
  showMcpForm: boolean;
  setShowMcpForm: (show: boolean) => void;
  editingMcpServer: McpServer | null;
  setEditingMcpServer: (server: McpServer | null) => void;

  // Loading state
  isLoading: boolean;
  isSaving: boolean;
  saveStatus: 'idle' | 'success' | 'error';

  // Actions
  loadSettings: () => Promise<void>;
  savePermissions: () => Promise<void>;
  addAllowedTool: () => void;
  removeAllowedTool: (tool: string) => void;
  addDisallowedTool: () => void;
  removeDisallowedTool: (tool: string) => void;
}

/**
 * Sub-hook for managing permission tool state and actions
 */
function usePermissionTools() {
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');

  const addAllowedTool = useCallback(() => {
    if (newAllowedTool.trim() && !allowedTools.includes(newAllowedTool.trim())) {
      setAllowedTools(prev => [...prev, newAllowedTool.trim()]);
      setNewAllowedTool('');
    }
  }, [newAllowedTool, allowedTools]);

  const removeAllowedTool = useCallback((tool: string) => {
    setAllowedTools(prev => prev.filter(t => t !== tool));
  }, []);

  const addDisallowedTool = useCallback(() => {
    if (newDisallowedTool.trim() && !disallowedTools.includes(newDisallowedTool.trim())) {
      setDisallowedTools(prev => [...prev, newDisallowedTool.trim()]);
      setNewDisallowedTool('');
    }
  }, [newDisallowedTool, disallowedTools]);

  const removeDisallowedTool = useCallback((tool: string) => {
    setDisallowedTools(prev => prev.filter(t => t !== tool));
  }, []);

  return {
    allowedTools,
    disallowedTools,
    newAllowedTool,
    newDisallowedTool,
    setAllowedTools,
    setDisallowedTools,
    setNewAllowedTool,
    setNewDisallowedTool,
    addAllowedTool,
    removeAllowedTool,
    addDisallowedTool,
    removeDisallowedTool,
  };
}

/**
 * Create load settings callback
 */
function createLoadSettingsCallback(
  agentType: AgentType,
  settingsService: ReturnType<typeof getSettingsService>,
  permissionTools: ReturnType<typeof usePermissionTools>,
  setSkipPermissions: (skip: boolean) => void,
  setMcpServers: (servers: McpServer[]) => void,
  setIsLoading: (loading: boolean) => void
) {
  return useCallback(async () => {
    setIsLoading(true);
    try {
      // Load permissions using getPermissions()
      const permissions = await settingsService.getPermissions();
      permissionTools.setAllowedTools(permissions.allowedTools || []);
      permissionTools.setDisallowedTools(permissions.disallowedTools || []);
      setSkipPermissions(permissions.skipPermissions || false);

      // Load MCP servers (no parameters needed)
      const servers = await settingsService.getMcpServers();
      setMcpServers(servers);
    } catch (error) {
      logger.error(`[useAgentSettings] Error loading settings for ${agentType}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [agentType, settingsService, permissionTools, setSkipPermissions, setMcpServers, setIsLoading]);
}

/**
 * Create save permissions callback
 */
function createSavePermissionsCallback(
  settingsService: ReturnType<typeof getSettingsService>,
  skipPermissions: boolean,
  allowedTools: string[],
  disallowedTools: string[],
  setIsSaving: (saving: boolean) => void,
  setSaveStatus: (status: 'idle' | 'success' | 'error') => void
) {
  return useCallback(async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const result = await settingsService.updatePermissions({
        skipPermissions,
        allowedTools,
        disallowedTools,
      });

      if (result.success) {
        setSaveStatus('success');
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      logger.error('[useAgentSettings] Error saving permissions:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [skipPermissions, allowedTools, disallowedTools, settingsService, setIsSaving, setSaveStatus]);
}

/**
 * Build the return object for useAgentSettings
 */
function buildAgentSettingsReturn(
  permissionTools: ReturnType<typeof usePermissionTools>,
  skipPermissions: boolean,
  setSkipPermissions: (skip: boolean) => void,
  mcpServers: McpServer[],
  setMcpServers: (servers: McpServer[]) => void,
  showMcpForm: boolean,
  setShowMcpForm: (show: boolean) => void,
  editingMcpServer: McpServer | null,
  setEditingMcpServer: (server: McpServer | null) => void,
  isLoading: boolean,
  isSaving: boolean,
  saveStatus: 'idle' | 'success' | 'error',
  loadSettings: () => Promise<void>,
  savePermissions: () => Promise<void>
): UseAgentSettingsReturn {
  return {
    // Permission settings
    allowedTools: permissionTools.allowedTools,
    disallowedTools: permissionTools.disallowedTools,
    skipPermissions,
    setAllowedTools: permissionTools.setAllowedTools,
    setDisallowedTools: permissionTools.setDisallowedTools,
    setSkipPermissions,

    // MCP servers
    mcpServers,
    setMcpServers,

    // Form state
    newAllowedTool: permissionTools.newAllowedTool,
    setNewAllowedTool: permissionTools.setNewAllowedTool,
    newDisallowedTool: permissionTools.newDisallowedTool,
    setNewDisallowedTool: permissionTools.setNewDisallowedTool,

    // UI state
    showMcpForm,
    setShowMcpForm,
    editingMcpServer,
    setEditingMcpServer,

    // Loading state
    isLoading,
    isSaving,
    saveStatus,

    // Actions
    loadSettings,
    savePermissions,
    addAllowedTool: permissionTools.addAllowedTool,
    removeAllowedTool: permissionTools.removeAllowedTool,
    addDisallowedTool: permissionTools.addDisallowedTool,
    removeDisallowedTool: permissionTools.removeDisallowedTool,
  };
}

// 由组件调用，自定义 Hook：useAgentSettings
/**
 * Custom hook for agent settings management
 */
export function useAgentSettings(params: UseAgentSettingsParams): UseAgentSettingsReturn {
  const { agentType } = params;

  const settingsService = getSettingsService();

  // Permission tools management
  const permissionTools = usePermissionTools();

  // Additional permission state
  const [skipPermissions, setSkipPermissions] = useState<boolean>(false);

  // MCP servers state
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  // UI state
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Create callbacks
  const loadSettings = createLoadSettingsCallback(
    agentType,
    settingsService,
    permissionTools,
    setSkipPermissions,
    setMcpServers,
    setIsLoading
  );

  const savePermissions = createSavePermissionsCallback(
    settingsService,
    skipPermissions,
    permissionTools.allowedTools,
    permissionTools.disallowedTools,
    setIsSaving,
    setSaveStatus
  );

  // Load settings when agent type changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings, agentType]);

  return buildAgentSettingsReturn(
    permissionTools,
    skipPermissions,
    setSkipPermissions,
    mcpServers,
    setMcpServers,
    showMcpForm,
    setShowMcpForm,
    editingMcpServer,
    setEditingMcpServer,
    isLoading,
    isSaving,
    saveStatus,
    loadSettings,
    savePermissions
  );
}

export default useAgentSettings;
