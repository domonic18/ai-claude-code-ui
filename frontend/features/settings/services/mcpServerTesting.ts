/**
 * MCP Server Testing Utilities
 *
 * 提供MCP服务器测试和工具发现功能
 *
 * @module features/settings/services/mcpServerTesting
 */

import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';

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
