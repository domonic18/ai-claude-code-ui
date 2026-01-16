/**
 * Settings Service
 *
 * API service layer for Settings feature module.
 * Handles all API calls related to settings management.
 */

import { authenticatedFetch } from '../../../utils/api';
import type { McpServer } from '../types/settings.types';

/**
 * Settings Service Class
 */
export class SettingsService {
  private projectName?: string;

  constructor(config?: { projectName?: string }) {
    this.projectName = config?.projectName;
  }

  /**
   * Update service configuration
   */
  setConfig(config: { projectName?: string }) {
    this.projectName = config.projectName;
  }

  /**
   * Fetch allowed tools
   */
  async getAllowedTools(): Promise<string[]> {
    try {
      const response = await authenticatedFetch('/api/settings/allowed-tools');
      if (!response.ok) throw new Error('Failed to fetch allowed tools');
      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      console.error('[SettingsService] Error fetching allowed tools:', error);
      return [];
    }
  }

  /**
   * Save allowed tools
   */
  async saveAllowedTools(tools: string[]): Promise<boolean> {
    try {
      const response = await authenticatedFetch('/api/settings/allowed-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools }),
      });
      return response.ok;
    } catch (error) {
      console.error('[SettingsService] Error saving allowed tools:', error);
      return false;
    }
  }

  /**
   * Fetch disallowed tools
   */
  async getDisallowedTools(): Promise<string[]> {
    try {
      const response = await authenticatedFetch('/api/settings/disallowed-tools');
      if (!response.ok) throw new Error('Failed to fetch disallowed tools');
      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      console.error('[SettingsService] Error fetching disallowed tools:', error);
      return [];
    }
  }

  /**
   * Save disallowed tools
   */
  async saveDisallowedTools(tools: string[]): Promise<boolean> {
    try {
      const response = await authenticatedFetch('/api/settings/disallowed-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools }),
      });
      return response.ok;
    } catch (error) {
      console.error('[SettingsService] Error saving disallowed tools:', error);
      return false;
    }
  }

  /**
   * Fetch skip permissions setting
   */
  async getSkipPermissions(): Promise<boolean> {
    try {
      const response = await authenticatedFetch('/api/settings/skip-permissions');
      if (!response.ok) throw new Error('Failed to fetch skip permissions');
      const data = await response.json();
      return data.skip || false;
    } catch (error) {
      console.error('[SettingsService] Error fetching skip permissions:', error);
      return false;
    }
  }

  /**
   * Save skip permissions setting
   */
  async saveSkipPermissions(skip: boolean): Promise<boolean> {
    try {
      const response = await authenticatedFetch('/api/settings/skip-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip }),
      });
      return response.ok;
    } catch (error) {
      console.error('[SettingsService] Error saving skip permissions:', error);
      return false;
    }
  }

  /**
   * Fetch MCP servers
   */
  async getMcpServers(agentType: string = 'claude'): Promise<McpServer[]> {
    try {
      const url = agentType === 'claude'
        ? '/api/mcp/servers'
        : `/api/${agentType}/mcp/servers`;
      const response = await authenticatedFetch(url);
      if (!response.ok) throw new Error('Failed to fetch MCP servers');
      const data = await response.json();
      return data.servers || [];
    } catch (error) {
      console.error('[SettingsService] Error fetching MCP servers:', error);
      return [];
    }
  }

  /**
   * Save MCP server
   */
  async saveMcpServer(server: McpServer, agentType: string = 'claude'): Promise<boolean> {
    try {
      const url = agentType === 'claude'
        ? '/api/mcp/servers'
        : `/api/${agentType}/mcp/servers`;
      const response = await authenticatedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      });
      return response.ok;
    } catch (error) {
      console.error('[SettingsService] Error saving MCP server:', error);
      return false;
    }
  }

  /**
   * Delete MCP server
   */
  async deleteMcpServer(serverName: string, agentType: string = 'claude'): Promise<boolean> {
    try {
      const url = agentType === 'claude'
        ? `/api/mcp/servers/${encodeURIComponent(serverName)}`
        : `/api/${agentType}/mcp/servers/${encodeURIComponent(serverName)}`;
      const response = await authenticatedFetch(url, {
        method: 'DELETE',
      });
      return response.ok;
    } catch (error) {
      console.error('[SettingsService] Error deleting MCP server:', error);
      return false;
    }
  }

  /**
   * Test MCP server connection
   */
  async testMcpServer(server: McpServer, agentType: string = 'claude'): Promise<{ success: boolean; tools?: string[]; error?: string }> {
    try {
      const url = agentType === 'claude'
        ? '/api/mcp/test'
        : `/api/${agentType}/mcp/test`;
      const response = await authenticatedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      });
      if (!response.ok) throw new Error('Failed to test MCP server');
      return await response.json();
    } catch (error) {
      console.error('[SettingsService] Error testing MCP server:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get project sort order
   */
  async getProjectSortOrder(): Promise<string> {
    try {
      const response = await authenticatedFetch('/api/settings/project-sort-order');
      if (!response.ok) throw new Error('Failed to fetch project sort order');
      const data = await response.json();
      return data.order || 'name';
    } catch (error) {
      console.error('[SettingsService] Error fetching project sort order:', error);
      return 'name';
    }
  }

  /**
   * Save project sort order
   */
  async saveProjectSortOrder(order: string): Promise<boolean> {
    try {
      const response = await authenticatedFetch('/api/settings/project-sort-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      return response.ok;
    } catch (error) {
      console.error('[SettingsService] Error saving project sort order:', error);
      return false;
    }
  }
}

/**
 * Singleton instance
 */
let serviceInstance: SettingsService | null = null;

/**
 * Get Settings service instance
 */
export function getSettingsService(config?: { projectName?: string }): SettingsService {
  if (!serviceInstance) {
    serviceInstance = new SettingsService(config);
  } else if (config) {
    serviceInstance.setConfig(config);
  }
  return serviceInstance;
}

export default SettingsService;
