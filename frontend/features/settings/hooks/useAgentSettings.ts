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
// 管理权限工具状态的子 Hook
function usePermissionTools() {
  // 允许的工具列表状态
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  // 禁止的工具列表状态
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);
  // 新添加的允许工具输入值
  const [newAllowedTool, setNewAllowedTool] = useState('');
  // 新添加的禁止工具输入值
  const [newDisallowedTool, setNewDisallowedTool] = useState('');

  // 添加允许的工具到列表
  const addAllowedTool = useCallback(() => {
    if (newAllowedTool.trim() && !allowedTools.includes(newAllowedTool.trim())) {
      setAllowedTools(prev => [...prev, newAllowedTool.trim()]);
      setNewAllowedTool('');
    }
  }, [newAllowedTool, allowedTools]);

  // 从允许列表中移除工具
  const removeAllowedTool = useCallback((tool: string) => {
    setAllowedTools(prev => prev.filter(t => t !== tool));
  }, []);

  // 添加禁止的工具到列表
  const addDisallowedTool = useCallback(() => {
    if (newDisallowedTool.trim() && !disallowedTools.includes(newDisallowedTool.trim())) {
      setDisallowedTools(prev => [...prev, newDisallowedTool.trim()]);
      setNewDisallowedTool('');
    }
  }, [newDisallowedTool, disallowedTools]);

  // 从禁止列表中移除工具
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
// 创建加载设置的回调函数
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
      // 从后端加载权限设置
      const permissions = await settingsService.getPermissions();
      permissionTools.setAllowedTools(permissions.allowedTools || []);
      permissionTools.setDisallowedTools(permissions.disallowedTools || []);
      setSkipPermissions(permissions.skipPermissions || false);

      // Load MCP servers (no parameters needed)
      // 从后端加载 MCP 服务器列表
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
// 创建保存权限设置的回调函数
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
      // 调用后端 API 更新权限设置
      const result = await settingsService.updatePermissions({
        skipPermissions,
        allowedTools,
        disallowedTools,
      });

      // 根据保存结果设置状态
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
// 构建 useAgentSettings Hook 的返回对象
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
    // 返回权限设置相关状态和操作
    allowedTools: permissionTools.allowedTools,
    disallowedTools: permissionTools.disallowedTools,
    skipPermissions,
    setAllowedTools: permissionTools.setAllowedTools,
    setDisallowedTools: permissionTools.setDisallowedTools,
    setSkipPermissions,

    // MCP servers
    // 返回 MCP 服务器相关状态和操作
    mcpServers,
    setMcpServers,

    // Form state
    // 返回表单输入状态
    newAllowedTool: permissionTools.newAllowedTool,
    setNewAllowedTool: permissionTools.setNewAllowedTool,
    newDisallowedTool: permissionTools.newDisallowedTool,
    setNewDisallowedTool: permissionTools.setNewDisallowedTool,

    // UI state
    // 返回 UI 状态（表单显示、编辑状态）
    showMcpForm,
    setShowMcpForm,
    editingMcpServer,
    setEditingMcpServer,

    // Loading state
    // 返回加载和保存状态
    isLoading,
    isSaving,
    saveStatus,

    // Actions
    // 返回操作函数（加载、保存、增删改工具）
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

  // 获取设置服务实例
  const settingsService = getSettingsService();

  // Permission tools management
  // 使用权限工具管理子 Hook
  const permissionTools = usePermissionTools();

  // Additional permission state
  // 跳过权限确认的开关状态
  const [skipPermissions, setSkipPermissions] = useState<boolean>(false);

  // MCP servers state
  // MCP 服务器列表状态
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  // UI state
  // MCP 表单显示状态
  const [showMcpForm, setShowMcpForm] = useState(false);
  // 正在编辑的 MCP 服务器状态
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);

  // Loading state
  // 加载状态标志
  const [isLoading, setIsLoading] = useState(false);
  // 保存状态标志
  const [isSaving, setIsSaving] = useState(false);
  // 保存结果状态（成功/失败/空闲）
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Create callbacks
  // 创建加载设置回调函数
  const loadSettings = createLoadSettingsCallback(
    agentType,
    settingsService,
    permissionTools,
    setSkipPermissions,
    setMcpServers,
    setIsLoading
  );

  // 创建保存权限设置回调函数
  const savePermissions = createSavePermissionsCallback(
    settingsService,
    skipPermissions,
    permissionTools.allowedTools,
    permissionTools.disallowedTools,
    setIsSaving,
    setSaveStatus
  );

  // Load settings when agent type changes
  // 当 Agent 类型改变时重新加载设置
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
