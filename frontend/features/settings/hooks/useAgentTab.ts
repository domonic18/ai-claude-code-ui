/**
 * useAgentTab Hook
 *
 * Custom hook that manages all state and business logic for the AgentTab component.
 * Extracted to reduce component size and improve testability.
 *
 * Features:
 * - Agent and category selection state
 * - Delegates to useAgentPermissions for Claude permissions management
 * - Delegates to useAgentMcpServers for MCP server CRUD operations
 */

import { useState, useEffect, useImperativeHandle } from 'react';
import { CategoryType } from '../components/common/CategoryTabs';
import { useAgentPermissions } from './useAgentPermissions';
import { useAgentMcpServers } from './useAgentMcpServers';

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
  mcpServers: import('../types/settings.types').McpServer[];
  projects: any[];
  showMcpForm: boolean;
  editingMcpServer: import('../types/settings.types').McpServer | null;
  mcpFormData: import('../components/agent/McpServerForm').McpFormData;
  mcpLoading: boolean;
  mcpTestResults: Record<string, any>;
  mcpServerTools: Record<string, any>;
  mcpToolsLoading: Record<string, boolean>;
  jsonValidationError: string;

  // Handlers
  openMcpForm: (server?: import('../types/settings.types').McpServer | null) => void;
  resetMcpForm: () => void;
  updateMcpConfig: (key: string, value: any) => void;
  handleMcpSubmit: (e: React.FormEvent) => Promise<void>;
  handleMcpDelete: (serverId: string) => Promise<void>;
  handleMcpTest: (serverId: string, scope: string) => Promise<void>;
  handleMcpToolsDiscovery: (serverId: string, scope: string) => Promise<void>;
  setMcpFormData: (data: import('../components/agent/McpServerForm').McpFormData) => void;
  setJsonValidationError: (error: string) => void;
}

/**
 * Custom hook to manage AgentTab state and logic
 * @param {React.Ref<AgentTabHandle>} ref - Imperative handle for parent component
 * @returns {UseAgentTabReturn} AgentTab state and handlers
 */
export const useAgentTab = (ref: React.Ref<AgentTabHandle>): UseAgentTabReturn => {
  // ===== Agent Selection State =====
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('claude');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('permissions');
  const [projects] = useState<any[]>([]);

  // ===== Delegate to specialized hooks =====
  const permissions = useAgentPermissions();
  const mcp = useAgentMcpServers();

  // ===== Effects =====
  useEffect(() => {
    // Permissions and MCP servers are loaded by their respective hooks
    // This effect exists for future cross-cutting concerns
  }, []);

  // Expose savePermissions method to parent via ref
  useImperativeHandle(ref, () => ({
    savePermissions: permissions.savePermissions,
  }));

  return {
    // Agent Selection
    selectedAgent,
    setSelectedAgent,
    selectedCategory,
    setSelectedCategory,
    projects,

    // Permissions (delegated to useAgentPermissions)
    skipPermissions: permissions.skipPermissions,
    setSkipPermissions: permissions.setSkipPermissions,
    allowedTools: permissions.allowedTools,
    setAllowedTools: permissions.setAllowedTools,
    disallowedTools: permissions.disallowedTools,
    setDisallowedTools: permissions.setDisallowedTools,
    newAllowedTool: permissions.newAllowedTool,
    setNewAllowedTool: permissions.setNewAllowedTool,
    newDisallowedTool: permissions.newDisallowedTool,
    setNewDisallowedTool: permissions.setNewDisallowedTool,

    // MCP Servers (delegated to useAgentMcpServers)
    mcpServers: mcp.mcpServers,
    showMcpForm: mcp.showMcpForm,
    editingMcpServer: mcp.editingMcpServer,
    mcpFormData: mcp.mcpFormData,
    mcpLoading: mcp.mcpLoading,
    mcpTestResults: mcp.mcpTestResults,
    mcpServerTools: mcp.mcpServerTools,
    mcpToolsLoading: mcp.mcpToolsLoading,
    jsonValidationError: mcp.jsonValidationError,
    openMcpForm: mcp.openMcpForm,
    resetMcpForm: mcp.resetMcpForm,
    updateMcpConfig: mcp.updateMcpConfig,
    handleMcpSubmit: mcp.handleMcpSubmit,
    handleMcpDelete: mcp.handleMcpDelete,
    handleMcpTest: mcp.handleMcpTest,
    handleMcpToolsDiscovery: mcp.handleMcpToolsDiscovery,
    setMcpFormData: mcp.setMcpFormData,
    setJsonValidationError: mcp.setJsonValidationError,
  };
};
