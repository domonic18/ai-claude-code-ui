/**
 * memoryService.ts
 *
 * 记忆管理 API 服务
 * 封装记忆文件相关的 API 调用
 */

import { api } from './api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MemoryResponse {
  content: string;
  path: string;
}

export interface MemoryWriteResponse {
  success: boolean;
  path: string;
}

/**
 * 记忆服务类
 */
class MemoryService {
  /**
   * 读取记忆文件
   * @returns {Promise<MemoryResponse>}
   */
  async readMemory(): Promise<MemoryResponse> {
    const response = await api.memory.read();
    const result: ApiResponse<MemoryResponse> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read memory');
    }
    return result.data;
  }

  /**
   * 保存记忆文件
   * @param {string} content - 记忆内容
   * @returns {Promise<MemoryWriteResponse>}
   */
  async writeMemory(content: string): Promise<MemoryWriteResponse> {
    const response = await api.memory.write(content);
    const result: ApiResponse<MemoryWriteResponse> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to write memory');
    }
    return result.data;
  }
}

// 导出单例实例
export const memoryService = new MemoryService();
export default memoryService;
