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

/**
 * Test MCP server connection
 */
export async function testMcpServer(id: string): Promise<{ success: boolean; message?: string }> {
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
    logger.error('[SettingsService] Error testing MCP server:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Discover tools from MCP server
 */
export async function discoverMcpTools(
  id: string
): Promise<{ success: boolean; data?: any; error?: string }> {
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
    logger.error('[SettingsService] Error discovering MCP tools:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate MCP server configuration (for JSON import)
 */
export async function validateMcpServer(server: {
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
    logger.error('[SettingsService] Error validating MCP server:', error);
    return { success: false, error: error.message };
  }
}
