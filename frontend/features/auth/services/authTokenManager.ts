/**
 * Authentication Token Manager
 *
 * Manages JWT token storage, validation, and session lifecycle.
 * Handles localStorage operations with expiration checking.
 *
 * @module features/auth/services/authTokenManager
 */

// 类型定义导入
import type { User, AuthSession } from '../types';
// 日志记录工具
import { logger } from '@/shared/utils/logger';

// 常量定义：默认 localStorage 存储键名
const DEFAULT_STORAGE_KEY = 'auth_session';
// 常量定义：会话过期时间（小时）
const SESSION_EXPIRY_HOURS = 24;
// 常量定义：会话过期时间（毫秒）
const SESSION_EXPIRY_MS = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;

/**
 * Create token manager
 *
 * @param {string} storageKey - localStorage key for session
 * @returns {Object} Token manager interface
 */
export function createTokenManager(storageKey: string = DEFAULT_STORAGE_KEY) {
  /**
   * Get stored session
   * 从 localStorage 读取并解析会话数据，检查过期时间
   *
   * @returns {AuthSession | null} Session object or null
   */
  function getSession(): AuthSession | null {
    try {
      // 从 localStorage 读取序列化的会话数据
      // 从 localStorage 读取会话数据
      const sessionData = localStorage.getItem(storageKey);
      if (!sessionData) {
        return null;
      }

      // 将 JSON 字符串解析为 JavaScript 对象
      // 解析 JSON 数据
      const session: AuthSession = JSON.parse(sessionData);

      // 检查会话是否已过期（比较过期时间与当前时间）
      // 检查会话是否已过期
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        clearSession();
        return null;
      }

      return session;
    } catch {
      // JSON 解析失败或 localStorage 读取异常，返回 null
      // 解析失败或读取错误，返回 null
      return null;
    }
  }

  /**
   * Store session
   * 将会话数据存储到 localStorage，并添加过期时间
   *
   * @param {AuthSession} session - Session to store
   */
  function storeSession(session: AuthSession): void {
    try {
      // 创建 Date 对象并设置过期时间为当前时间 + 24 小时
      // 设置会话过期时间为当前时间 + 24 小时
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

      // 使用展开运算符合并原始会话数据和过期时间
      // 创建包含过期时间的会话对象
      const sessionWithExpiry: AuthSession = {
        ...session,
        expiresAt,
      };

      // 将会话对象序列化为 JSON 字符串并存储到 localStorage
      // 将会话数据存储到 localStorage
      localStorage.setItem(storageKey, JSON.stringify(sessionWithExpiry));
    } catch (error) {
      logger.error('Store session error:', error);
    }
  }

  /**
   * Clear session
   * 从 localStorage 移除会话数据，用于登出操作
   */
  function clearSession(): void {
    try {
      // 使用 localStorage.removeItem 方法删除指定键的数据
      // 从 localStorage 移除会话数据
      localStorage.removeItem(storageKey);
    } catch (error) {
      logger.error('Clear session error:', error);
    }
  }

  /**
   * Get token
   * 从当前会话中提取 JWT 认证 token
   *
   * @returns {string | null} JWT token or null
   */
  function getToken(): string | null {
    // 调用 getSession 函数获取当前会话对象
    // 从会话中获取认证 token
    const session = getSession();
    return session?.token || null;
  }

  /**
   * Get current user
   * 从当前会话中提取用户信息对象
   *
   * @returns {User | null} User object or null
   */
  function getCurrentUser(): User | null {
    // 调用 getSession 函数获取当前会话对象
    // 从会话中获取当前用户信息
    const session = getSession();
    return session?.user || null;
  }

  /**
   * Update session user
   * 更新当前会话中的用户信息（用于用户资料修改后同步）
   *
   * @param {User} user - Updated user data
   */
  function updateSessionUser(user: User): void {
    try {
      // 获取当前会话对象
      // 获取当前会话
      const session = getSession();
      if (session) {
        // 使用展开运算符合并会话数据和新的用户数据
        // 更新会话中的用户数据
        const updatedSession: AuthSession = {
          ...session,
          user,
        };
        // 序列化并存储更新后的会话数据
        // 将更新后的会话存储回 localStorage
        localStorage.setItem(storageKey, JSON.stringify(updatedSession));
      }
    } catch (error) {
      logger.error('Update session user error:', error);
    }
  }

  /**
   * Check if authenticated
   * 检查当前会话是否已认证（用户是否已登录）
   *
   * @returns {boolean} Authentication status
   */
  function isAuthenticated(): boolean {
    // 获取当前会话对象并检查认证标志
    // 检查会话是否已认证
    const session = getSession();
    return session?.isAuthenticated || false;
  }

  return {
    getSession,
    storeSession,
    clearSession,
    getToken,
    getCurrentUser,
    updateSessionUser,
    isAuthenticated,
  };
}
