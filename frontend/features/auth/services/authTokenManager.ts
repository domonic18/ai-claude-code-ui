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
   *
   * @returns {AuthSession | null} Session object or null
   */
  function getSession(): AuthSession | null {
    try {
      // 从 localStorage 读取会话数据
      const sessionData = localStorage.getItem(storageKey);
      if (!sessionData) {
        return null;
      }

      // 解析 JSON 数据
      const session: AuthSession = JSON.parse(sessionData);

      // 检查会话是否已过期
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        clearSession();
        return null;
      }

      return session;
    } catch {
      // 解析失败或读取错误，返回 null
      return null;
    }
  }

  /**
   * Store session
   *
   * @param {AuthSession} session - Session to store
   */
  function storeSession(session: AuthSession): void {
    try {
      // 设置会话过期时间为当前时间 + 24 小时
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

      // 创建包含过期时间的会话对象
      const sessionWithExpiry: AuthSession = {
        ...session,
        expiresAt,
      };

      // 将会话数据存储到 localStorage
      localStorage.setItem(storageKey, JSON.stringify(sessionWithExpiry));
    } catch (error) {
      logger.error('Store session error:', error);
    }
  }

  /**
   * Clear session
   */
  function clearSession(): void {
    try {
      // 从 localStorage 移除会话数据
      localStorage.removeItem(storageKey);
    } catch (error) {
      logger.error('Clear session error:', error);
    }
  }

  /**
   * Get token
   *
   * @returns {string | null} JWT token or null
   */
  function getToken(): string | null {
    // 从会话中获取认证 token
    const session = getSession();
    return session?.token || null;
  }

  /**
   * Get current user
   *
   * @returns {User | null} User object or null
   */
  function getCurrentUser(): User | null {
    // 从会话中获取当前用户信息
    const session = getSession();
    return session?.user || null;
  }

  /**
   * Update session user
   *
   * @param {User} user - Updated user data
   */
  function updateSessionUser(user: User): void {
    try {
      // 获取当前会话
      const session = getSession();
      if (session) {
        // 更新会话中的用户数据
        const updatedSession: AuthSession = {
          ...session,
          user,
        };
        // 将更新后的会话存储回 localStorage
        localStorage.setItem(storageKey, JSON.stringify(updatedSession));
      }
    } catch (error) {
      logger.error('Update session user error:', error);
    }
  }

  /**
   * Check if authenticated
   *
   * @returns {boolean} Authentication status
   */
  function isAuthenticated(): boolean {
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
