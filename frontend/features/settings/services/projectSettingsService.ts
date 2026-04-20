/**
 * projectSettingsService.ts
 *
 * Project Settings Service
 *
 * 项目设置相关 API 调用，从 settingsService.ts 提取以降低复杂度
 *
 * @module features/settings/services/projectSettingsService
 */

import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';

/**
 * Get project sort order
 */
export async function getProjectSortOrder(): Promise<string> {
  try {
    const response = await api.get('/settings/project-sort-order');
    if (!response.ok) throw new Error('Failed to fetch project sort order');
    const data = await response.json();
    return data.order || 'name';
  } catch (error) {
    logger.error('[SettingsService] Error fetching project sort order:', error);
    return 'name';
  }
}

/**
 * Save project sort order
 */
export async function saveProjectSortOrder(order: string): Promise<boolean> {
  try {
    const response = await api.user.settings.update('claude', { projectSortOrder: order });
    return response.ok;
  } catch (error) {
    logger.error('[SettingsService] Error saving project sort order:', error);
    return false;
  }
}
