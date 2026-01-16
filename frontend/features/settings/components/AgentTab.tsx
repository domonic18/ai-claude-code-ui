/**
 * AgentTab Component
 *
 * Handles agent-specific settings for Claude and OpenCode (placeholder).
 *
 * Structure:
 * - Agent list sidebar (desktop) / top tabs (mobile)
 * - Category tabs: Permissions, MCP Servers
 * - Category content based on selected agent
 *
 * Note: Cursor and Codex have been removed.
 * OpenCode is currently a placeholder and not yet supported.
 * Account tab has been removed as it has no actual functionality.
 * Auto-save has been removed - settings are now saved manually via Save button.
 */

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { X, Globe, FolderOpen } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { api } from '../../../utils/api';
import AgentListItem from '../../../components/settings/AgentListItem';
import PermissionsContent from '../../../components/settings/PermissionsContent';
import McpServersContent from '../../../components/settings/McpServersContent';

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
 * AgentTab Component - Manages agent settings for Claude and OpenCode
 */
export const AgentTab = forwardRef<AgentTabHandle, AgentTabProps>((props, ref) => {
  // ===== Agent Selection State =====
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('claude');
  const [selectedCategory, setSelectedCategory] = useState<'permissions' | 'mcp'>('permissions');

  // ===== Claude-specific States =====
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [allowedTools, setAllowedTools] = useState([]);
  const [disallowedTools, setDisallowedTools] = useState([]);
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [hasLoadedInitialSettings, setHasLoadedInitialSettings] = useState(false);

  // ===== MCP Server States (Claude) =====
  const [mcpServers, setMcpServers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState(null);
  const [mcpFormData, setMcpFormData] = useState<{
    name: string;
    type: string;
    scope: string;
    projectPath: string;
    importMode: string;
    jsonInput: string;
    config: {
      command: string;
      args: string[];
      env: Record<string, string>;
      url: string;
      headers: Record<string, string>;
      timeout: number;
    };
    raw?: any;
  }>({
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
    try {
      // Load Claude permissions from user settings API
      const permsResponse = await fetch('/api/users/settings/claude');
      if (permsResponse.ok) {
        const response = await permsResponse.json();
        // API returns { success: true, data: {...}, message: "..." }
        if (response.success && response.data) {
          setSkipPermissions(response.data.skipPermissions || false);
          setAllowedTools(response.data.allowedTools || []);
          setDisallowedTools(response.data.disallowedTools || []);
          // Mark that initial settings have been loaded
          setHasLoadedInitialSettings(true);
        }
      } else {
        console.error('[AgentTab] Failed to load permissions:', permsResponse.statusText);
        // Still mark as loaded to allow user to configure
        setHasLoadedInitialSettings(true);
      }

      // Load MCP servers
      loadMcpServers();

    } catch (error) {
      console.error('[AgentTab] Error loading agent settings:', error);
      // Still mark as loaded to allow user to configure
      setHasLoadedInitialSettings(true);
    }
  };

  const loadMcpServers = async () => {
    try {
      const response = await api.user.mcpServers.getAll();
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        // Only parse as JSON if the response is actually JSON
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          // API returns { success: true, data: [...], message: "..." }
          setMcpServers(result.data || []);
        } else {
          console.warn('[AgentTab] MCP servers API returned non-JSON response');
          setMcpServers([]);
        }
      } else {
        // API returned an error status (404, 500, etc.)
        console.warn(`[AgentTab] MCP servers API returned status: ${response.status}`);
        setMcpServers([]);
      }
    } catch (error) {
      console.error('[AgentTab] Error loading MCP servers:', error);
      setMcpServers([]);
    }
  };

  // Save permissions to database
  const savePermissions = async (currentSkipPermissions, currentAllowedTools, currentDisallowedTools) => {
    try {
      const response = await fetch('/api/users/settings/claude', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skipPermissions: currentSkipPermissions,
          allowedTools: currentAllowedTools,
          disallowedTools: currentDisallowedTools,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[AgentTab] Permissions saved successfully:', result.message);
      } else {
        console.error('[AgentTab] Failed to save permissions:', response.statusText);
      }
    } catch (error) {
      console.error('[AgentTab] Error saving permissions:', error);
    }
  };

  // ===== MCP Handlers =====
  const openMcpForm = (server = null) => {
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

  const updateMcpConfig = (key, value) => {
    setMcpFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

  const saveMcpServer = async (serverData) => {
    try {
      if (editingMcpServer) {
        const response = await api.user.mcpServers.update(editingMcpServer.id, {
          name: serverData.name,
          type: serverData.type,
          config: serverData.config,
          enabled: serverData.enabled !== undefined ? serverData.enabled : true
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            await loadMcpServers();
            return true;
          } else {
            throw new Error(result.error || 'Failed to update server');
          }
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update server');
        }
      } else {
        const response = await api.user.mcpServers.create({
          name: serverData.name,
          type: serverData.type,
          config: serverData.config
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            await loadMcpServers();
            return true;
          } else {
            throw new Error(result.error || 'Failed to create server');
          }
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create server');
        }
      }
    } catch (error) {
      console.error('[AgentTab] Error saving MCP server:', error);
      throw error;
    }
  };

  const handleMcpSubmit = async (e) => {
    e.preventDefault();

    setMcpLoading(true);

    try {
      if (mcpFormData.importMode === 'json') {
        const response = await api.user.mcpServers.validate({
          name: mcpFormData.name,
          jsonConfig: mcpFormData.jsonInput,
          scope: mcpFormData.scope,
          projectPath: mcpFormData.projectPath
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            await loadMcpServers();
            resetMcpForm();
          } else {
            throw new Error(result.error || 'Failed to add server via JSON');
          }
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Failed to add server');
        }
      } else {
        await saveMcpServer(mcpFormData);
        resetMcpForm();
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setMcpLoading(false);
    }
  };

  const handleMcpDelete = async (serverId, scope) => {
    try {
      const response = await api.user.mcpServers.delete(serverId);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadMcpServers();
        } else {
          console.error('[AgentTab] Failed to delete server:', result.error);
        }
      }
    } catch (error) {
      console.error('[AgentTab] Error deleting MCP server:', error);
    }
  };

  const handleMcpTest = async (serverId, scope) => {
    try {
      const response = await api.user.mcpServers.test(serverId);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          setMcpTestResults(prev => ({
            ...prev,
            [`${scope}-${serverId}`]: result
          }));
        } else {
          console.warn('[AgentTab] MCP test returned non-JSON response');
        }
      } else {
        console.warn(`[AgentTab] MCP test returned status: ${response.status}`);
      }
    } catch (error) {
      console.error('[AgentTab] Error testing MCP server:', error);
    }
  };

  const handleMcpToolsDiscovery = async (serverId, scope) => {
    setMcpToolsLoading(prev => ({ ...prev, [`${scope}-${serverId}`]: true }));
    try {
      const response = await api.user.mcpServers.discoverTools(serverId);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          setMcpServerTools(prev => ({
            ...prev,
            [`${scope}-${serverId}`]: result.data || result
          }));
        } else {
          console.warn('[AgentTab] MCP tools discovery returned non-JSON response');
        }
      } else {
        console.warn(`[AgentTab] MCP tools discovery returned status: ${response.status}`);
      }
    } catch (error) {
      console.error('[AgentTab] Error discovering MCP tools:', error);
    } finally {
      setMcpToolsLoading(prev => ({ ...prev, [`${scope}-${serverId}`]: false }));
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[400px] md:min-h-[500px]">
      {/* Mobile: Horizontal Agent Tabs */}
      <div className="md:hidden border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex">
          <AgentListItem
            agentId="claude"
            isSelected={selectedAgent === 'claude'}
            onClick={() => setSelectedAgent('claude')}
            isMobile={true}
          />
          <AgentListItem
            agentId="opencode"
            isSelected={selectedAgent === 'opencode'}
            onClick={() => setSelectedAgent('opencode')}
            isMobile={true}
          />
        </div>
      </div>

      {/* Desktop: Sidebar - Agent List */}
      <div className="hidden md:block w-48 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="p-2">
          <AgentListItem
            agentId="claude"
            isSelected={selectedAgent === 'claude'}
            onClick={() => setSelectedAgent('claude')}
          />
          <AgentListItem
            agentId="opencode"
            isSelected={selectedAgent === 'opencode'}
            onClick={() => setSelectedAgent('opencode')}
          />
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Category Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex px-2 md:px-4 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('permissions')}
              className={`px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedCategory === 'permissions'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Permissions
            </button>
            <button
              onClick={() => setSelectedCategory('mcp')}
              className={`px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedCategory === 'mcp'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              MCP Servers
            </button>
          </div>
        </div>

        {/* Category Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {/* OpenCode - Show placeholder for all categories */}
          {selectedAgent === 'opencode' && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  OpenCode
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                  OpenCode integration is coming soon. This feature is currently under development and will be available in a future update.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Claude - Permissions Category */}
          {selectedAgent === 'claude' && selectedCategory === 'permissions' && (
            <PermissionsContent
              agent="claude"
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
            <McpServersContent
              agent="claude"
              servers={mcpServers}
              onAdd={() => openMcpForm()}
              onEdit={(server) => openMcpForm(server)}
              onDelete={(serverId, scope) => handleMcpDelete(serverId, scope)}
              onTest={(serverId, scope) => handleMcpTest(serverId, scope)}
              onDiscoverTools={(serverId, scope) => handleMcpToolsDiscovery(serverId, scope)}
              testResults={mcpTestResults}
              serverTools={mcpServerTools}
              toolsLoading={mcpToolsLoading}
            />
          )}
        </div>
      </div>

      {/* MCP Server Form Modal */}
      {showMcpForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-medium text-foreground">
                {editingMcpServer ? 'Edit MCP Server' : 'Add MCP Server'}
              </h3>
              <Button variant="ghost" size="sm" onClick={resetMcpForm}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleMcpSubmit} className="p-4 space-y-4">

              {!editingMcpServer && (
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setMcpFormData(prev => ({...prev, importMode: 'form'}))}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    mcpFormData.importMode === 'form'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Form Input
                </button>
                <button
                  type="button"
                  onClick={() => setMcpFormData(prev => ({...prev, importMode: 'json'}))}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    mcpFormData.importMode === 'json'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  JSON Import
                </button>
              </div>
              )}

              {/* Show current scope when editing */}
              {mcpFormData.importMode === 'form' && editingMcpServer && (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Scope
                  </label>
                  <div className="flex items-center gap-2">
                    {mcpFormData.scope === 'user' ? <Globe className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
                    <span className="text-sm">
                      {mcpFormData.scope === 'user' ? 'User (Global)' : 'Project (Local)'}
                    </span>
                    {mcpFormData.scope === 'local' && mcpFormData.projectPath && (
                      <span className="text-xs text-muted-foreground">
                        - {mcpFormData.projectPath}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Scope cannot be changed when editing an existing server
                  </p>
                </div>
              )}

              {/* Scope Selection - Moved to top, disabled when editing */}
              {mcpFormData.importMode === 'form' && !editingMcpServer && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Scope *
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMcpFormData(prev => ({...prev, scope: 'user', projectPath: ''}))}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          mcpFormData.scope === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Globe className="w-4 h-4" />
                          <span>User (Global)</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMcpFormData(prev => ({...prev, scope: 'local'}))}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          mcpFormData.scope === 'local'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <FolderOpen className="w-4 h-4" />
                          <span>Project (Local)</span>
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {mcpFormData.scope === 'user'
                        ? 'User scope: Available across all projects on your machine'
                        : 'Local scope: Only available in the selected project'
                      }
                    </p>
                  </div>

                  {/* Project Selection for Local Scope */}
                  {mcpFormData.scope === 'local' && !editingMcpServer && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Project *
                      </label>
                      <select
                        value={mcpFormData.projectPath}
                        onChange={(e) => setMcpFormData(prev => ({...prev, projectPath: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        required={mcpFormData.scope === 'local'}
                      >
                        <option value="">Select a project...</option>
                        {projects.map(project => (
                          <option key={project.name} value={project.path || project.fullPath}>
                            {project.displayName || project.name}
                          </option>
                        ))}
                      </select>
                      {mcpFormData.projectPath && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Path: {mcpFormData.projectPath}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={mcpFormData.importMode === 'json' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Server Name *
                  </label>
                  <Input
                    value={mcpFormData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setMcpFormData(prev => ({...prev, name: e.target.value}));
                    }}
                    placeholder="my-server"
                    required
                  />
                </div>

                {mcpFormData.importMode === 'form' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Transport Type *
                    </label>
                    <select
                      value={mcpFormData.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setMcpFormData(prev => ({...prev, type: e.target.value}));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="stdio">stdio</option>
                      <option value="sse">SSE</option>
                      <option value="http">HTTP</option>
                    </select>
                  </div>
                )}
              </div>


              {/* Show raw configuration details when editing */}
              {editingMcpServer && mcpFormData.raw && mcpFormData.importMode === 'form' && (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Configuration Details (from {editingMcpServer.scope === 'global' ? '~/.claude.json' : 'project config'})
                  </h4>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto">
                    {JSON.stringify(mcpFormData.raw, null, 2)}
                  </pre>
                </div>
              )}

              {/* JSON Import Mode */}
              {mcpFormData.importMode === 'json' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      JSON Configuration *
                    </label>
                    <textarea
                      value={mcpFormData.jsonInput}
                      onChange={(e) => {
                        setMcpFormData(prev => ({...prev, jsonInput: e.target.value}));
                        // Validate JSON as user types
                        try {
                          if (e.target.value.trim()) {
                            const parsed = JSON.parse(e.target.value);
                            // Basic validation
                            if (!parsed.type) {
                              setJsonValidationError('Missing required field: type');
                            } else if (parsed.type === 'stdio' && !parsed.command) {
                              setJsonValidationError('stdio type requires a command field');
                            } else if ((parsed.type === 'http' || parsed.type === 'sse') && !parsed.url) {
                              setJsonValidationError(`${parsed.type} type requires a url field`);
                            } else {
                              setJsonValidationError('');
                            }
                          }
                        } catch (err) {
                          if (e.target.value.trim()) {
                            setJsonValidationError('Invalid JSON format');
                          } else {
                            setJsonValidationError('');
                          }
                        }
                      }}
                      className={`w-full px-3 py-2 border ${jsonValidationError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500`}
                      rows={8}
                      placeholder={`{
  "type": "stdio",
  "command": "/path/to/server",
  "args": ["--api-key", "abc123"],
  "env": {
    "CACHE_DIR": "/tmp"
  }
}`}
                      required
                    />
                    {jsonValidationError && (
                      <p className="text-xs text-red-500 mt-1">{jsonValidationError}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Paste your MCP server configuration in JSON format. Example formats:
                      <br />• stdio: {`{"type":"stdio","command":"npx","args":["@upstash/context7-mcp"]}`}
                      <br />• http/sse: {`{"type":"http","url":"https://api.example.com/mcp"}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Transport-specific Config - Only show in form mode */}
              {mcpFormData.importMode === 'form' && mcpFormData.type === 'stdio' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Command *
                    </label>
                    <Input
                      value={mcpFormData.config.command}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMcpConfig('command', e.target.value)}
                      placeholder="/path/to/mcp-server"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Arguments (one per line)
                    </label>
                    <textarea
                      value={Array.isArray(mcpFormData.config.args) ? mcpFormData.config.args.join('\n') : ''}
                      onChange={(e) => updateMcpConfig('args', e.target.value.split('\n').filter(arg => arg.trim()))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                      rows={3}
                      placeholder={`--api-key
abc123`}
                    />
                  </div>
                </div>
              )}

              {mcpFormData.importMode === 'form' && (mcpFormData.type === 'sse' || mcpFormData.type === 'http') && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    URL *
                  </label>
                  <Input
                    value={mcpFormData.config.url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMcpConfig('url', e.target.value)}
                    placeholder="https://api.example.com/mcp"
                    type="url"
                    required
                  />
                </div>
              )}

              {/* Environment Variables - Only show in form mode */}
              {mcpFormData.importMode === 'form' && (
                <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Environment Variables (KEY=value, one per line)
                </label>
                <textarea
                  value={Object.entries(mcpFormData.config.env || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                  onChange={(e) => {
                    const env = {};
                    e.target.value.split('\n').forEach(line => {
                      const [key, ...valueParts] = line.split('=');
                      if (key && key.trim()) {
                        env[key.trim()] = valueParts.join('=').trim();
                      }
                    });
                    updateMcpConfig('env', env);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                  rows={3}
                  placeholder={`API_KEY=your-key
DEBUG=true`}
                />
              </div>
              )}

              {mcpFormData.importMode === 'form' && (mcpFormData.type === 'sse' || mcpFormData.type === 'http') && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Headers (KEY=value, one per line)
                  </label>
                  <textarea
                    value={Object.entries(mcpFormData.config.headers || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                    onChange={(e) => {
                      const headers = {};
                      e.target.value.split('\n').forEach(line => {
                        const [key, ...valueParts] = line.split('=');
                        if (key && key.trim()) {
                          headers[key.trim()] = valueParts.join('=').trim();
                        }
                      });
                      updateMcpConfig('headers', headers);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                    rows={3}
                    placeholder={`Authorization=Bearer token
X-API-Key=your-key`}
                  />
                </div>
              )}


              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetMcpForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mcpLoading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  {mcpLoading ? 'Saving...' : (editingMcpServer ? 'Update Server' : 'Add Server')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

AgentTab.displayName = 'AgentTab';

export default AgentTab;
