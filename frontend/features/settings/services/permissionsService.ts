/**
 * permissionsService.ts
 *
 * Permissions Service
 *
 * Claude 权限相关 API 调用，从 settingsService.ts 提取以降低复杂度
 *
 * @module features/settings/services/permissionsService
 */

import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';

export interface ClaudePermissions {
  skipPermissions: boolean;
  allowedTools: string[];
  disallowedTools: string[];
}

/**
 * Get Claude permissions
 */
export async function getPermissions(): Promise<ClaudePermissions> {
  try {
    const response = await api.user.permissions.get();
    if (!response.ok) {
      logger.warn('[SettingsService] Failed to fetch permissions:', response.statusText);
      return { skipPermissions: false, allowedTools: [], disallowedTools: [] };
    }

    const result = await response.json();
    return result.data || { skipPermissions: false, allowedTools: [], disallowedTools: [] };
  } catch (error) {
    logger.error('[SettingsService] Error fetching permissions:', error);
    return { skipPermissions: false, allowedTools: [], disallowedTools: [] };
  }
}

/**
 * Update Claude permissions
 */
export async function updatePermissions(
  data: ClaudePermissions
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await api.user.permissions.update(data);
    if (!response.ok) {
      throw new Error(`Failed to update permissions: ${response.statusText}`);
    }

    const result = await response.json();
    return { success: result.success, message: result.message };
  } catch (error) {
    logger.error('[SettingsService] Error updating permissions:', error);
    return { success: false };
  }
}
