/**
 * Auth Operations
 *
 * 提取的认证操作逻辑（登录、注册、登出、状态检查）。
 *
 * ## 包含内容
 * - 登录、注册、登出操作
 * - 认证状态检查
 * - Platform 模式检测辅助函数
 */

import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/shared/services';
import { requestDeduplicator } from '@/shared/utils';
import type { User } from '@/shared/types';
import { logger } from '@/shared/utils/logger';
import type { AuthResult } from './AuthContext';

/**
 * 检查是否为 Platform 模式
 * @returns {boolean} 是否为 Platform 模式
 */
export const isPlatformMode = (): boolean => {
  return import.meta.env.VITE_IS_PLATFORM === 'true';
};

/**
 * 认证状态检查 Hook
 *
 * 在组件挂载时检查认证状态，处理 Platform 模式和普通模式。
 *
 * @param {React.Dispatch<React.SetStateAction<User | null>>} setUser - 设置用户状态
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setIsLoading - 设置加载状态
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setNeedsSetup - 设置是否需要初始化
 * @param {React.Dispatch<React.SetStateAction<string | null>>} setError - 设置错误状态
 * @returns {() => Promise<void>} checkAuthStatus 函数
 */
export const useAuthStatusCheck = (
  setUser: React.Dispatch<React.SetStateAction<User | null>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setNeedsSetup: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
): (() => Promise<void>) => {
  const hasCheckedRef = useRef<boolean>(false);

  /**
   * 初始化时检查认证状态
   *
   * 调用时序：
   * 1. AuthProvider 挂载 → useEffect 执行
   * 2. 检查 Platform 模式 → 如果是则直接设置用户
   * 3. 否则调用 checkAuthStatus() → requestDeduplicator 确保不重复
   */
  useEffect(() => {
    if (isPlatformMode()) {
      setUser({ username: 'platform-user', id: 'platform' });
      setNeedsSetup(false);
      setIsLoading(false);
      hasCheckedRef.current = true;
      return;
    }

    // 使用 requestDeduplicator 防止 StrictMode 导致的双重调用
    if (!hasCheckedRef.current) {
      checkAuthStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 检查认证状态
   *
   * 使用 requestDeduplicator 确保并发调用只执行一次请求。
   * 这比使用 ref 更优雅，因为它基于 Promise 共享机制。
   *
   * 使用 useCallback 包装以避免在 ProtectedRoute 中触发无限循环。
   *
   * @param {boolean} force - 强制重新检查，忽略 hasChecked 标志
   */
  const checkAuthStatus = useCallback(async (force = false) => {
    // 如果已经检查过且不强制重新检查，直接返回
    if (hasCheckedRef.current && !force) {
      return;
    }

    // 使用统一的请求去重器，key: 'auth:checkStatus'
    // 当 force=true 时，使用不同的 key 来避免缓存
    const dedupeKey = force ? 'auth:checkStatus:force' : 'auth:checkStatus';

    return requestDeduplicator.dedupe(dedupeKey, async () => {
      try {
        setIsLoading(true);
        setError(null);

        const statusResponse = await api.auth.status();
        const statusData = await statusResponse.json();

        if (statusData.data?.needsSetup) {
          setNeedsSetup(true);
          hasCheckedRef.current = true;
          setIsLoading(false);
          return;
        }

        try {
          const userResponse = await api.auth.user();

          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUser(userData.data);
            setNeedsSetup(false);
          } else {
            setUser(null);
          }
        } catch (err) {
          setUser(null);
        }
      } catch (err) {
        logger.error('Auth status check failed:', err);
        setError('Failed to check authentication status');
      } finally {
        setIsLoading(false);
        hasCheckedRef.current = true;
      }
    });
  }, [setIsLoading, setError, setUser, setNeedsSetup]);

  return checkAuthStatus;
};

/**
 * 创建登录操作
 *
 * @param {React.Dispatch<React.SetStateAction<User | null>>} setUser - 设置用户状态
 * @param {React.Dispatch<React.SetStateAction<string | null>>} setError - 设置错误状态
 * @returns {(username: string, password: string) => Promise<AuthResult>} login 函数
 */
export const createLoginOperation = (
  setUser: React.Dispatch<React.SetStateAction<User | null>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
): ((username: string, password: string) => Promise<AuthResult>) => {
  return useCallback(async (username: string, password: string): Promise<AuthResult> => {
    try {
      setError(null);
      const response = await api.auth.login(username, password);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorMessage = 'Server error. Please check the server logs.';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const data = await response.json();

      if (response.ok) {
        setUser(data.data);
        return { success: true };
      } else {
        setError(data.error || 'Login failed');
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (err) {
      logger.error('Login error:', err);
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setUser, setError]);
};

/**
 * 创建注册操作
 *
 * @param {React.Dispatch<React.SetStateAction<User | null>>} setUser - 设置用户状态
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setNeedsSetup - 设置是否需要初始化
 * @param {React.Dispatch<React.SetStateAction<string | null>>} setError - 设置错误状态
 * @returns {(username: string, password: string) => Promise<AuthResult>} register 函数
 */
export const createRegisterOperation = (
  setUser: React.Dispatch<React.SetStateAction<User | null>>,
  setNeedsSetup: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
): ((username: string, password: string) => Promise<AuthResult>) => {
  return useCallback(async (username: string, password: string): Promise<AuthResult> => {
    try {
      setError(null);
      const response = await api.auth.register(username, password);

      const data = await response.json();

      if (response.ok) {
        setUser(data.data);
        setNeedsSetup(false);
        return { success: true };
      } else {
        setError(data.error || 'Registration failed');
        return { success: false, error: data.error || 'Registration failed' };
      }
    } catch (err) {
      logger.error('Registration error:', err);
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [setUser, setNeedsSetup, setError]);
};

/**
 * 创建登出操作
 *
 * @param {React.Dispatch<React.SetStateAction<User | null>>} setUser - 设置用户状态
 * @returns {() => Promise<void>} logout 函数
 */
export const createLogoutOperation = (
  setUser: React.Dispatch<React.SetStateAction<User | null>>
): (() => Promise<void>) => {
  return useCallback(async () => {
    setUser(null);
    try {
      await api.auth.logout();
    } catch (err) {
      logger.error('Logout endpoint error:', err);
    }
  }, [setUser]);
};
