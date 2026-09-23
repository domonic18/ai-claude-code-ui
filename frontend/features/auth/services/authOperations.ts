/**
 * 认证操作模块
 *
 * 处理认证相关的 API 调用：登出和用户资料操作（登录/注册/密码管理已随 SSO-only 改造移除）。
 *
 * @module features/auth/services/authOperations
 */

// 国际化翻译工具
import { t as translate } from '@/shared/i18n';
// 类型定义
import type { User } from '../types';
// 日志记录工具
import { logger } from '@/shared/utils/logger';

// 常量定义：API 端点路径
const API_ENDPOINTS = {
  LOGOUT: '/logout',
  ME: '/me',
  VALIDATE: '/validate'
} as const;

// 常量定义：HTTP 方法
const HTTP_METHODS = {
  POST: 'POST',
  GET: 'GET',
  PATCH: 'PATCH'
} as const;

/**
 * 执行登出操作
 *
 * 通知后端登出用户，并清除本地会话信息。
 * 即使后端请求失败，也会清除本地会话。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {Function} clearSession - 清除会话的函数
 * @returns {Promise<void>}
 */
export async function executeLogout(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void
): Promise<void> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    if (token) {
      // 通知后端登出
      await fetch(`${baseUrl}${API_ENDPOINTS.LOGOUT}`, {
        method: HTTP_METHODS.POST,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    // 记录错误日志，但不影响后续的会话清除
    logger.error('Logout error:', error);
  } finally {
    // 无论 API 调用是否成功，都清除本地会话
    clearSession();
  }
}


/**
 * 从服务器刷新用户数据
 *
 * 获取最新的用户信息并更新本地会话。
 * 如果 token 已过期或无效，则清除会话。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {Function} clearSession - 清除会话的函数
 * @param {Function} updateSessionUser - 更新会话中用户信息的函数
 * @returns {Promise<User | null>} 更新后的用户对象，失败返回 null
 */
export async function refreshUser(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void,
  updateSessionUser: (user: User) => void
): Promise<User | null> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    if (!token) {
      return null;
    }

    // 请求后端获取最新用户信息
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.ME}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // 检查响应是否成功
    if (!response.ok) {
      // token 可能已过期，清除本地会话
      clearSession();
      return null;
    }

    // 解析用户数据
    const user = await response.json();
    // 更新本地会话中的用户信息
    updateSessionUser(user);

    return user;
  } catch (error) {
    // 记录错误日志
    logger.error('Refresh user error:', error);
    return null;
  }
}

/**
 * 更新用户资料
 *
 * 向后端发送用户资料更新请求，成功后更新本地会话。
 * 支持部分更新（只修改提供的字段）。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {Function} updateSessionUser - 更新会话中用户信息的函数
 * @param {Partial<User>} updates - 要更新的用户字段（部分更新）
 * @returns {Promise<User | null>} 更新后的用户对象，失败返回 null
 */
export async function updateUser(
  baseUrl: string,
  getToken: () => string | null,
  updateSessionUser: (user: User) => void,
  updates: Partial<User>
): Promise<User | null> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // 发送 PATCH 请求更新用户资料
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.ME}`, {
      method: HTTP_METHODS.PATCH,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    // 检查响应是否成功
    if (!response.ok) {
      throw new Error('Failed to update user');
    }

    // 解析更新后的用户数据
    const updatedUser = await response.json();
    // 更新本地会话中的用户信息
    updateSessionUser(updatedUser);

    return updatedUser;
  } catch (error) {
    // 记录错误日志
    logger.error('Update user error:', error);
    return null;
  }
}

/**
 * 向服务器验证 token 有效性
 *
 * 检查当前用户的认证 token 是否仍然有效。
 * 如果 token 无效或过期，则清除本地会话。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {Function} clearSession - 清除会话的函数
 * @returns {Promise<boolean>} token 是否有效
 */
export async function validateToken(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void
): Promise<boolean> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    if (!token) {
      return false;
    }

    // 向后端发送 token 验证请求
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.VALIDATE}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // 检查响应是否成功
    if (!response.ok) {
      // token 无效或已过期，清除本地会话
      clearSession();
      return false;
    }

    // token 有效
    return true;
  } catch {
    // 发生异常，清除本地会话
    clearSession();
    return false;
  }
}
