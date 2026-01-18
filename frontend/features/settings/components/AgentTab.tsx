/**
 * AgentTab Component
 *
 * Main container for agent-specific settings (Claude and OpenCode).
 * Manages state and delegates rendering to extracted sub-components.
 *
 * Features:
 * - Agent selection (Claude/OpenCode)
 * - Category tabs (Permissions/MCP Servers)
 * - Permission settings management
 * - MCP server management (add/edit/delete/test)
 *
 * Note: Cursor and Codex have been removed.
 * Auto-save has been removed - settings are saved manually via Save button.
 * All API calls now use settingsService for centralized management.
 */

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { getSettingsService } from '../services/settingsService';
import { AgentSelector } from './agent/AgentSelector';
import AgentPermissions from './agent/AgentPermissions';
import { McpServerForm, McpFormData } from './agent/McpServerForm';
import McpServerList from './mcp/McpServerList';
import { CategoryTabs, CategoryType } from './common/CategoryTabs';
import { OpenCodePlaceholder } from './common/OpenCodePlaceholder';
import { McpServer } from '../types/settings.types';

interface AgentTabProps {
  // Props passed from parent Settings if needed
  // Currently self-contained
}

type AgentType = 'claude' | 'opencode';

/**
 * Exposed methods for parent component
 */
export interface AgentTabHandle {
  savePermissions: () => void;
}

/**
 * AgentTab Component - Main container for agent settings
 */
export const AgentTab = forwardRef<AgentTabHandle, AgentTabProps>((_props, ref) => {
  // ===== Agent Selection State =====
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('claude');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('permissions');

  // ===== Claude-specific States =====
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [allowedTools, setAllowedTools] = useState([]);
  const [disallowedTools, setDisallowedTools] = useState([]);
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');

  // ===== MCP Server States (Claude) =====
  const [mcpServers, setMcpServers] = useState([]);
  const [projects] = useState([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);
  const [mcpFormData, setMcpFormData] = useState<McpFormData>({
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
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpTestResults, setMcpTestResults] = useState({});
  const [mcpServerTools, setMcpServerTools] = useState({});
  const [mcpToolsLoading, setMcpToolsLoading] = useState({});
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
      console.error('[AgentTab] Error loading agent settings:', error);
    }
  };

  const loadMcpServers = async () => {
    const service = getSettingsService();

    try {
      const servers = await service.getMcpServers();
      setMcpServers(servers);
    } catch (error) {
      console.error('[AgentTab] Error loading MCP servers:', error);
      setMcpServers([]);
    }
  };

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
        console.log('[AgentTab] Permissions saved successfully:', result.message);
      } else {
        console.error('[AgentTab] Failed to save permissions');
      }
    } catch (error) {
      console.error('[AgentTab] Error saving permissions:', error);
    }
  };

  // ===== MCP Handlers =====
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
      setMcpFormData({
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
    }
    setJsonValidationError('');
    setShowMcpForm(true);
  };

  const resetMcpForm = () => {
    setShowMcpForm(false);
    setEditingMcpServer(null);
    setMcpFormData({
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
    setJsonValidationError('');
  };

  const updateMcpConfig = (key: string, value: any) => {
    setMcpFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

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
      console.error('[AgentTab] Error saving MCP server:', error);
      throw error;
    }
  };

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

  const handleMcpDelete = async (serverId: string) => {
    const service = getSettingsService();

    try {
      const result = await service.deleteMcpServer(serverId);
      if (result.success) {
        await loadMcpServers();
      } else {
        console.error('[AgentTab] Failed to delete server:', result.error);
      }
    } catch (error) {
      console.error('[AgentTab] Error deleting MCP server:', error);
    }
  };

  const handleMcpTest = async (serverId: string, scope: string) => {
    const service = getSettingsService();

    try {
      const result = await service.testMcpServer(serverId);
      setMcpTestResults(prev => ({
        ...prev,
        [`${scope}-${serverId}`]: result
      }));
    } catch (error) {
      console.error('[AgentTab] Error testing MCP server:', error);
    }
  };

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
      console.error('[AgentTab] Error discovering MCP tools:', error);
    } finally {
      setMcpToolsLoading(prev => ({ ...prev, [`${scope}-${serverId}`]: false }));
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[400px] md:min-h-[500px]">
      {/* Agent Selector */}
      <AgentSelector
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
      />

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Category Tabs */}
        <CategoryTabs
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Category Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {/* OpenCode - Placeholder */}
          {selectedAgent === 'opencode' && <OpenCodePlaceholder />}

          {/* Claude - Permissions Category */}
          {selectedAgent === 'claude' && selectedCategory === 'permissions' && (
            <AgentPermissions
              skipPermissions={skipPermissions}
              setSkipPermissions={setSkipPermissions}
              allowedTools={allowedTools}
              setAllowedTools={setAllowedTools}
              disallowedTools={disallowedTools}
              setDisallowedTools={setDisallowedTools}
              newAllowedTool={newAllowedTool}
              setNewAllowedTool={setNewAllowedTool}
              newDisallowedTool={newDisallowedTool}
              setNewDisallowedTool={setNewDisallowedTool}
            />
          )}

          {/* Claude - MCP Servers Category */}
          {selectedAgent === 'claude' && selectedCategory === 'mcp' && (
            <McpServerList
              agent="claude"
              servers={mcpServers}
              onAdd={() => openMcpForm()}
              onEdit={(server: McpServer) => openMcpForm(server)}
              onDelete={(serverId: string) => handleMcpDelete(serverId)}
              onTest={(serverId: string, scope: string) => handleMcpTest(serverId, scope)}
              onDiscoverTools={(serverId: string, scope: string) => handleMcpToolsDiscovery(serverId, scope)}
              testResults={mcpTestResults}
              serverTools={mcpServerTools}
              toolsLoading={mcpToolsLoading}
            />
          )}
        </div>
      </div>

      {/* MCP Server Form Modal */}
      <McpServerForm
        show={showMcpForm}
        editingServer={editingMcpServer}
        formData={mcpFormData}
        projects={projects}
        loading={mcpLoading}
        jsonValidationError={jsonValidationError}
        onClose={resetMcpForm}
        onSubmit={handleMcpSubmit}
        onFormDataChange={setMcpFormData}
        onValidationErrorChange={setJsonValidationError}
        onConfigChange={updateMcpConfig}
      />
    </div>
  );
});

AgentTab.displayName = 'AgentTab';

export default AgentTab;
