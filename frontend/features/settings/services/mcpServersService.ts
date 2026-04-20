/**
 * mcpServersService.ts
 *
 * MCP Servers Service
 *
 * MCP 服务器相关 API 调用，从 settingsService.ts 提取以降低复杂度
 *
 * @module features/settings/services/mcpServersService
 */

import { api } from '@/shared/services';
import type { McpServer } from '../types/settings.types';
import { logger } from '@/shared/utils/logger';

// Re-export testing and validation functions from mcpServerTesting.ts
export { testMcpServer, discoverMcpTools, validateMcpServer } from './mcpServerTesting';

/**
 * Get all MCP servers for the user
 */
export async function getMcpServers(): Promise<McpServer[]> {
  try {
    const response = await api.user.mcpServers.getAll();
    if (!response.ok) {
      logger.warn('[SettingsService] Failed to fetch MCP servers:', response.statusText);
      return [];
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      return result.data || [];
    }
    return [];
  } catch (error) {
    logger.error('[SettingsService] Error fetching MCP servers:', error);
    return [];
  }
}

/**
 * Create a new MCP server
 */
export async function createMcpServer(
  server: Partial<McpServer>
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.user.mcpServers.create(server);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create MCP server');
    }

    const result = await response.json();
    return { success: result.success };
  } catch (error) {
    logger.error('[SettingsService] Error creating MCP server:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing MCP server
 */
export async function updateMcpServer(
  id: string,
  server: Partial<McpServer>
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.user.mcpServers.update(id, server);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update MCP server');
    }

    const result = await response.json();
    return { success: result.success };
  } catch (error) {
    logger.error('[SettingsService] Error updating MCP server:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an MCP server
 */
export async function deleteMcpServer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.user.mcpServers.delete(id);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete MCP server');
    }

    const result = await response.json();
    return { success: result.success };
  } catch (error) {
    logger.error('[SettingsService] Error deleting MCP server:', error);
    return { success: false, error: error.message };
  }
}
