/**
 * Settings Service
 *
 * API service layer for Settings feature module.
 * Handles all API calls related to settings management.
 *
 * Note: This service uses api.js for centralized API endpoint management.
 * All API URLs are defined in frontend/utils/api.js
 */

// Permissions API
export {
  getPermissions,
  updatePermissions,
  type ClaudePermissions
} from './permissionsService';

// MCP Servers API
export {
  getMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  testMcpServer,
  discoverMcpTools,
  validateMcpServer
} from './mcpServersService';

// Project Settings API
export {
  getProjectSortOrder,
  saveProjectSortOrder
} from './projectSettingsService';

// Re-export types
import type { McpServer } from '../types/settings.types';

export type { McpServer };

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
  async getPermissions() {
    return (await import('./permissionsService')).getPermissions();
  }

  async updatePermissions(data: any) {
    return (await import('./permissionsService')).updatePermissions(data);
  }

  // ===== MCP Servers =====
  async getMcpServers() {
    return (await import('./mcpServersService')).getMcpServers();
  }

  async createMcpServer(server: any) {
    return (await import('./mcpServersService')).createMcpServer(server);
  }

  async updateMcpServer(id: string, server: any) {
    return (await import('./mcpServersService')).updateMcpServer(id, server);
  }

  async deleteMcpServer(id: string) {
    return (await import('./mcpServersService')).deleteMcpServer(id);
  }

  async testMcpServer(id: string) {
    return (await import('./mcpServersService')).testMcpServer(id);
  }

  async discoverMcpTools(id: string) {
    return (await import('./mcpServersService')).discoverMcpTools(id);
  }

  async validateMcpServer(server: any) {
    return (await import('./mcpServersService')).validateMcpServer(server);
  }

  // ===== Project Settings =====
  async getProjectSortOrder() {
    return (await import('./projectSettingsService')).getProjectSortOrder();
  }

  async saveProjectSortOrder(order: string) {
    return (await import('./projectSettingsService')).saveProjectSortOrder(order);
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
