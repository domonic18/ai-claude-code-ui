/**
 * Settings Service
 *
 * API service layer for Settings feature module.
 * Handles all API calls related to settings management.
 *
 * Note: This service uses api.js for centralized API endpoint management.
 * All API URLs are defined in frontend/utils/api.js
 */

// 权限管理 API（Permissions API）
export {
  getPermissions,
  updatePermissions,
  type ClaudePermissions
} from './permissionsService';

// MCP 服务器管理 API（MCP Servers API）
export {
  getMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  testMcpServer,
  discoverMcpTools,
  validateMcpServer
} from './mcpServersService';

// 项目设置 API（Project Settings API）
export {
  getProjectSortOrder,
  saveProjectSortOrder
} from './projectSettingsService';

// 重新导出类型定义
import type { McpServer } from '../types/settings.types';

export type { McpServer };

/**
 * Settings Service Class
 */
// 设置服务类，统一管理所有设置相关的 API 调用
export class SettingsService {
  private projectName?: string;  // 项目名称配置

  constructor(config?: { projectName?: string }) {
    this.projectName = config?.projectName;
  }

  /**
   * Update service configuration
   */
  // 更新服务配置
  setConfig(config: { projectName?: string }) {
    this.projectName = config.projectName;
  }

  // ===== Permissions (Claude) =====
  // 获取 Claude 权限设置
  async getPermissions() {
    return (await import('./permissionsService')).getPermissions();
  }

  // 更新 Claude 权限设置
  async updatePermissions(data: any) {
    return (await import('./permissionsService')).updatePermissions(data);
  }

  // ===== MCP Servers =====
  // 获取所有 MCP 服务器
  async getMcpServers() {
    return (await import('./mcpServersService')).getMcpServers();
  }

  // 创建新的 MCP 服务器
  async createMcpServer(server: any) {
    return (await import('./mcpServersService')).createMcpServer(server);
  }

  // 更新 MCP 服务器配置
  async updateMcpServer(id: string, server: any) {
    return (await import('./mcpServersService')).updateMcpServer(id, server);
  }

  // 删除 MCP 服务器
  async deleteMcpServer(id: string) {
    return (await import('./mcpServersService')).deleteMcpServer(id);
  }

  // 测试 MCP 服务器连接
  async testMcpServer(id: string) {
    return (await import('./mcpServersService')).testMcpServer(id);
  }

  // 发现 MCP 工具列表
  async discoverMcpTools(id: string) {
    return (await import('./mcpServersService')).discoverMcpTools(id);
  }

  // 验证 MCP 服务器配置
  async validateMcpServer(server: any) {
    return (await import('./mcpServersService')).validateMcpServer(server);
  }

  // ===== Project Settings =====
  // 获取项目排序方式
  async getProjectSortOrder() {
    return (await import('./projectSettingsService')).getProjectSortOrder();
  }

  // 保存项目排序方式
  async saveProjectSortOrder(order: string) {
    return (await import('./projectSettingsService')).saveProjectSortOrder(order);
  }
}

/**
 * Singleton instance
 */
// 单例实例
let serviceInstance: SettingsService | null = null;

/**
 * Get Settings service instance
 */
// 获取设置服务单例实例
export function getSettingsService(config?: { projectName?: string }): SettingsService {
  if (!serviceInstance) {
    serviceInstance = new SettingsService(config);
  } else if (config) {
    serviceInstance.setConfig(config);
  }
  return serviceInstance;
}

export default SettingsService;
