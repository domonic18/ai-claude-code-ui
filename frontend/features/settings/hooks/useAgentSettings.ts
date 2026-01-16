/**
 * useAgentSettings Hook
 *
 * Custom hook for managing agent-specific settings (Claude, Cursor, Codex).
 * Handles permissions, MCP servers, and agent configuration.
 */

import { useState, useCallback, useEffect } from 'react';
import { getSettingsService } from '../services/settingsService';
import type { AgentType, PermissionSettings, McpServer } from '../types/settings.types';

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
 * Custom hook for agent settings management
 */
export function useAgentSettings(params: UseAgentSettingsParams): UseAgentSettingsReturn {
  const { agentType } = params;

  const settingsService = getSettingsService();

  // Permission settings state
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);
  const [skipPermissions, setSkipPermissions] = useState<boolean>(false);

  // MCP servers state
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  // Form state
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');

  // UI state
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  /**
   * Load all settings for current agent
   */
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load permissions
      const [allowed, disallowed, skip] = await Promise.all([
        settingsService.getAllowedTools(),
        settingsService.getDisallowedTools(),
        settingsService.getSkipPermissions(),
      ]);

      setAllowedTools(allowed);
      setDisallowedTools(disallowed);
      setSkipPermissions(skip);

      // Load MCP servers
      const servers = await settingsService.getMcpServers(agentType);
      setMcpServers(servers);
    } catch (error) {
      console.error(`[useAgentSettings] Error loading settings for ${agentType}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [agentType, settingsService]);

  /**
   * Save permission settings
   */
  const savePermissions = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const results = await Promise.all([
        settingsService.saveAllowedTools(allowedTools),
        settingsService.saveDisallowedTools(disallowedTools),
        settingsService.saveSkipPermissions(skipPermissions),
      ]);

      const allSuccess = results.every(r => r === true);
      setSaveStatus(allSuccess ? 'success' : 'error');
    } catch (error) {
      console.error('[useAgentSettings] Error saving permissions:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [allowedTools, disallowedTools, skipPermissions, settingsService]);

  /**
   * Add a new allowed tool
   */
  const addAllowedTool = useCallback(() => {
    if (newAllowedTool.trim() && !allowedTools.includes(newAllowedTool.trim())) {
      setAllowedTools(prev => [...prev, newAllowedTool.trim()]);
      setNewAllowedTool('');
    }
  }, [newAllowedTool, allowedTools]);

  /**
   * Remove an allowed tool
   */
  const removeAllowedTool = useCallback((tool: string) => {
    setAllowedTools(prev => prev.filter(t => t !== tool));
  }, []);

  /**
   * Add a new disallowed tool
   */
  const addDisallowedTool = useCallback(() => {
    if (newDisallowedTool.trim() && !disallowedTools.includes(newDisallowedTool.trim())) {
      setDisallowedTools(prev => [...prev, newDisallowedTool.trim()]);
      setNewDisallowedTool('');
    }
  }, [newDisallowedTool, disallowedTools]);

  /**
   * Remove a disallowed tool
   */
  const removeDisallowedTool = useCallback((tool: string) => {
    setDisallowedTools(prev => prev.filter(t => t !== tool));
  }, []);

  // Load settings when agent type changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings, agentType]);

  return {
    // Permission settings
    allowedTools,
    disallowedTools,
    skipPermissions,
    setAllowedTools,
    setDisallowedTools,
    setSkipPermissions,

    // MCP servers
    mcpServers,
    setMcpServers,

    // Form state
    newAllowedTool,
    setNewAllowedTool,
    newDisallowedTool,
    setNewDisallowedTool,

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
    addAllowedTool,
    removeAllowedTool,
    addDisallowedTool,
    removeDisallowedTool,
  };
}

export default useAgentSettings;
