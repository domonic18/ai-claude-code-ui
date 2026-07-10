/**
 * userPromptService.ts
 *
 * 用户提示词管理 API 服务
 * 封装用户提示词文件相关的 API 调用
 */

import { api } from './api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UserPromptResponse {
  content: string;
  path: string;
}

export interface UserPromptWriteResponse {
  success: boolean;
  path: string;
}

/**
 * 用户提示词服务类
 */
class UserPromptService {
  /**
   * 读取用户提示词文件
   * @returns {Promise<UserPromptResponse>}
   */
  async readUserPrompt(): Promise<UserPromptResponse> {
    const response = await api.userPrompt.read();
    const result: ApiResponse<UserPromptResponse> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read user prompt');
    }
    return result.data;
  }

  /**
   * 保存用户提示词文件
   * @param {string} content - 用户提示词内容
   * @returns {Promise<UserPromptWriteResponse>}
   */
  async writeUserPrompt(content: string): Promise<UserPromptWriteResponse> {
    const response = await api.userPrompt.write(content);
    const result: ApiResponse<UserPromptWriteResponse> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to write user prompt');
    }
    return result.data;
  }
}

// 导出单例实例
export const userPromptService = new UserPromptService();
export default userPromptService;
