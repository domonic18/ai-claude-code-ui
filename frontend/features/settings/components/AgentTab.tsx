/**
 * AgentTab Component
 *
 * Main container for agent-specific settings (Claude and OpenCode).
 * Delegates state management to useAgentTab hook and renders sub-components.
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

import React, { forwardRef } from 'react';
import { AgentSelector } from './agent/AgentSelector';
import AgentPermissions from './agent/AgentPermissions';
import { McpServerForm } from './agent/McpServerForm';
import McpServerList from './mcp/McpServerList';
import { CategoryTabs } from './common/CategoryTabs';
import { OpenCodePlaceholder } from './common/OpenCodePlaceholder';
import { McpServer } from '../types/settings.types';
import { useAgentTab } from '../hooks/useAgentTab';

interface AgentTabProps {
  // Props passed from parent Settings if needed
  // Currently self-contained
}

// AgentTabHandle 的类型定义
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
  const hook = useAgentTab(ref);

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[400px] md:min-h-[500px]">
      <AgentSelector
        selectedAgent={hook.selectedAgent}
        onSelectAgent={hook.setSelectedAgent}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <CategoryTabs
          selectedCategory={hook.selectedCategory}
          onSelectCategory={hook.setSelectedCategory}
        />

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {hook.selectedAgent === 'opencode' && <OpenCodePlaceholder />}

          {hook.selectedAgent === 'claude' && hook.selectedCategory === 'permissions' && (
            <AgentPermissions
              skipPermissions={hook.skipPermissions}
              setSkipPermissions={hook.setSkipPermissions}
              allowedTools={hook.allowedTools}
              setAllowedTools={hook.setAllowedTools}
              disallowedTools={hook.disallowedTools}
              setDisallowedTools={hook.setDisallowedTools}
              newAllowedTool={hook.newAllowedTool}
              setNewAllowedTool={hook.setNewAllowedTool}
              newDisallowedTool={hook.newDisallowedTool}
              setNewDisallowedTool={hook.setNewDisallowedTool}
            />
          )}

          {hook.selectedAgent === 'claude' && hook.selectedCategory === 'mcp' && (
            <McpServerList
              agent="claude"
              servers={hook.mcpServers}
              onAdd={() => hook.openMcpForm()}
              onEdit={(server: McpServer) => hook.openMcpForm(server)}
              onDelete={(serverId: string) => hook.handleMcpDelete(serverId)}
              onTest={(serverId: string, scope: string) => hook.handleMcpTest(serverId, scope)}
              onDiscoverTools={(serverId: string, scope: string) => hook.handleMcpToolsDiscovery(serverId, scope)}
              testResults={hook.mcpTestResults}
              serverTools={hook.mcpServerTools}
              toolsLoading={hook.mcpToolsLoading}
            />
          )}
        </div>
      </div>

      <McpServerForm
        show={hook.showMcpForm}
        editingServer={hook.editingMcpServer}
        formData={hook.mcpFormData}
        projects={hook.projects}
        loading={hook.mcpLoading}
        jsonValidationError={hook.jsonValidationError}
        onClose={hook.resetMcpForm}
        onSubmit={hook.handleMcpSubmit}
        onFormDataChange={hook.setMcpFormData}
        onValidationErrorChange={hook.setJsonValidationError}
        onConfigChange={hook.updateMcpConfig}
      />
    </div>
  );
});

AgentTab.displayName = 'AgentTab';

export default AgentTab;
