/**
 * settingsApiService.ts
 *
 * Settings API Service
 *
 * 通用 API 请求处理逻辑，从 settingsService.ts 提取以降低复杂度
 *
 * @module features/settings/services/settingsApiService
 */

import { api } from '@/shared/services';
import { logger } from '@/shared/utils/logger';

/**
 * 通用 API 错误处理
 * @param error - 错误对象
 * @param context - 错误上下文
 * @returns 标准化错误响应
 */
function handleApiError(error: any, context: string): { success: boolean; error?: string } {
  logger.error(`[SettingsService] ${context}:`, error);
  return { success: false, error: error.message || 'Unknown error' };
}

/**
 * 通用 GET 请求处理
 * @param endpoint - API 端点
 * @param context - 错误上下文
 * @param defaultValue - 失败时的默认返回值
 * @returns Promise<any>
 */
export async function apiGet<T>(
  endpoint: string,
  context: string,
  defaultValue: T
): Promise<T> {
  try {
    const response = await api.get(endpoint);
    if (!response.ok) {
      logger.warn(`[SettingsService] Failed ${context}:`, response.statusText);
      return defaultValue;
    }
    const result = await response.json();
    return result.data || defaultValue;
  } catch (error) {
    logger.error(`[SettingsService] Error ${context}:`, error);
    return defaultValue;
  }
}

/**
 * 通用 POST/PUT/PATCH 请求处理
 * @param requestFn - 请求函数
 * @param context - 错误上下文
 * @returns Promise<{ success: boolean; message?: string }>
 */
export async function apiMutation(
  requestFn: () => Promise<Response>,
  context: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await requestFn();
    if (!response.ok) {
      throw new Error(`Failed: ${response.statusText}`);
    }
    const result = await response.json();
    return { success: result.success, message: result.message };
  } catch (error) {
    return handleApiError(error, context);
  }
}

/**
 * 通用 MCP 服务器操作处理
 * @param requestFn - 请求函数
 * @param operation - 操作名称
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function mcpServerOperation(
  requestFn: () => Promise<Response>,
  operation: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await requestFn();
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to ${operation}`);
    }
    const result = await response.json();
    return { success: result.success };
  } catch (error) {
    return handleApiError(error, `Error ${operation}`);
  }
}
