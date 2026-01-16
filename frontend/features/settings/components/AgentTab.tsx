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
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
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
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState(null);
  const [mcpFormData, setMcpFormData] = useState({
    name: '',
    type: 'stdio',
    scope: 'user',
    projectPath: '',
    importMode: 'form',
    jsonConfig: '',
    config: {
      command: '',
      args: [],
      env: {}
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
      const response = await fetch('/api/mcp/servers');
      if (response.ok) {
        const data = await response.json();
        setMcpServers(data.servers || []);
      }
    } catch (error) {
      console.error('[AgentTab] Error loading MCP servers:', error);
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
        ...server,
        importMode: 'form'
      });
    } else {
      setEditingMcpServer(null);
      setMcpFormData({
        name: '',
        type: 'stdio',
        scope: 'user',
        projectPath: '',
        importMode: 'form',
        jsonConfig: '',
        config: {
          command: '',
          args: [],
          env: {}
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
      jsonConfig: '',
      config: {
        command: '',
        args: [],
        env: {}
      }
    });
    setJsonValidationError('');
  };

  const handleMcpSubmit = async (e) => {
    e.preventDefault();
    // Implementation from original Settings.jsx
    // TODO: Complete this handler
    setMcpLoading(true);
    try {
      // Submit MCP server configuration
      // ...
      await loadMcpServers();
      resetMcpForm();
    } catch (error) {
      console.error('[AgentTab] Error saving MCP server:', error);
    } finally {
      setMcpLoading(false);
    }
  };

  const handleMcpDelete = async (serverId, scope) => {
    try {
      const response = await fetch(`/api/mcp/servers/${encodeURIComponent(serverId)}?scope=${scope}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await loadMcpServers();
      }
    } catch (error) {
      console.error('[AgentTab] Error deleting MCP server:', error);
    }
  };

  const handleMcpTest = async (serverId, scope) => {
    try {
      const response = await fetch(`/api/mcp/servers/${encodeURIComponent(serverId)}/test?scope=${scope}`, {
        method: 'POST'
      });
      if (response.ok) {
        const result = await response.json();
        setMcpTestResults(prev => ({
          ...prev,
          [`${scope}-${serverId}`]: result
        }));
      }
    } catch (error) {
      console.error('[AgentTab] Error testing MCP server:', error);
    }
  };

  const handleMcpToolsDiscovery = async (serverId, scope) => {
    setMcpToolsLoading(prev => ({ ...prev, [`${scope}-${serverId}`]: true }));
    try {
      const response = await fetch(`/api/mcp/servers/${encodeURIComponent(serverId)}/tools?scope=${scope}`, {
        method: 'POST'
      });
      if (response.ok) {
        const tools = await response.json();
        setMcpServerTools(prev => ({
          ...prev,
          [`${scope}-${serverId}`]: tools
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
              {/* TODO: Complete MCP form implementation */}
              <div className="text-center text-muted-foreground">
                MCP form implementation - TODO
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
