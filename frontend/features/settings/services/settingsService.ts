/**
 * Settings Service
 *
 * API service layer for Settings feature module.
 * Handles all API calls related to settings management.
 *
 * Note: This service uses api.js for centralized API endpoint management.
 * All API URLs are defined in frontend/utils/api.js
 */

import { api } from '../../../utils/api';
import type { McpServer } from '../types/settings.types';

export interface ClaudePermissions {
  skipPermissions: boolean;
  allowedTools: string[];
  disallowedTools: string[];
}

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

  // ===== Permissions (Claude) =====

  /**
   * Get Claude permissions
   */
  async getPermissions(): Promise<ClaudePermissions> {
    try {
      const response = await api.user.permissions.get();
      if (!response.ok) {
        console.warn('[SettingsService] Failed to fetch permissions:', response.statusText);
        return { skipPermissions: false, allowedTools: [], disallowedTools: [] };
      }

      const result = await response.json();
      return result.data || { skipPermissions: false, allowedTools: [], disallowedTools: [] };
    } catch (error) {
      console.error('[SettingsService] Error fetching permissions:', error);
      return { skipPermissions: false, allowedTools: [], disallowedTools: [] };
    }
  }

  /**
   * Update Claude permissions
   */
  async updatePermissions(data: ClaudePermissions): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.user.permissions.update(data);
      if (!response.ok) {
        throw new Error(`Failed to update permissions: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: result.success, message: result.message };
    } catch (error) {
      console.error('[SettingsService] Error updating permissions:', error);
      return { success: false };
    }
  }

  // ===== MCP Servers =====

  /**
   * Get all MCP servers for the user
   */
  async getMcpServers(): Promise<McpServer[]> {
    try {
      const response = await api.user.mcpServers.getAll();
      if (!response.ok) {
        console.warn('[SettingsService] Failed to fetch MCP servers:', response.statusText);
        return [];
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        return result.data || [];
      }
      return [];
    } catch (error) {
      console.error('[SettingsService] Error fetching MCP servers:', error);
      return [];
    }
  }

  /**
   * Create a new MCP server
   */
  async createMcpServer(server: Partial<McpServer>): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await api.user.mcpServers.create(server);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create MCP server');
      }

      const result = await response.json();
      return { success: result.success };
    } catch (error) {
      console.error('[SettingsService] Error creating MCP server:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing MCP server
   */
  async updateMcpServer(id: string, server: Partial<McpServer>): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await api.user.mcpServers.update(id, server);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update MCP server');
      }

      const result = await response.json();
      return { success: result.success };
    } catch (error) {
      console.error('[SettingsService] Error updating MCP server:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an MCP server
   */
  async deleteMcpServer(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await api.user.mcpServers.delete(id);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete MCP server');
      }

      const result = await response.json();
      return { success: result.success };
    } catch (error) {
      console.error('[SettingsService] Error deleting MCP server:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test MCP server connection
   */
  async testMcpServer(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.user.mcpServers.test(id);
      if (!response.ok) {
        throw new Error(`Failed to test MCP server: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return { success: false, message: 'No response from server' };
    } catch (error) {
      console.error('[SettingsService] Error testing MCP server:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Discover tools from MCP server
   */
  async discoverMcpTools(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.user.mcpServers.discoverTools(id);
      if (!response.ok) {
        throw new Error(`Failed to discover MCP tools: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        return { success: true, data: result.data || result };
      }
      return { success: false, error: 'Invalid response format' };
    } catch (error) {
      console.error('[SettingsService] Error discovering MCP tools:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate MCP server configuration (for JSON import)
   */
  async validateMcpServer(server: {
    name: string;
    jsonConfig: string;
    scope: string;
    projectPath?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await api.user.mcpServers.validate(server);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to validate MCP server');
      }

      const result = await response.json();
      return { success: result.success };
    } catch (error) {
      console.error('[SettingsService] Error validating MCP server:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get project sort order
   */
  async getProjectSortOrder(): Promise<string> {
    try {
      const response = await api.get('/settings/project-sort-order');
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
      const response = await api.user.settings.update('claude', { projectSortOrder: order });
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
