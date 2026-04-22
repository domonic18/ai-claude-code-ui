/**
 * Auth Hooks
 *
 * Custom hooks for authentication functionality.
 * These hooks wrap the shared AuthContext and provide additional utilities.
 */

// React Hooks 导入
import { useCallback, useEffect, useState } from 'react';
// 共享认证上下文
import { useAuth as useSharedAuth } from '@/shared/contexts/AuthContext';
// 认证服务
import { getAuthService } from '../services';
// 类型定义
import type {
  User,
  LoginCredentials,
  RegistrationData,
  AuthResponse,
} from '../types';

// LoginModal、SetupForm 和各个需要认证信息的页面组件调用此 hook 获取用户状态
/**
 * Hook for authentication functionality
 * Extends the shared useAuth with additional methods
 */
export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  register: (data: RegistrationData) => Promise<AuthResponse>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// 常量定义：认证状态键名
const AUTH_STORAGE_KEYS = {
  ERROR: 'authError'
} as const;

// LoginModal、SetupForm 和各个需要认证信息的页面组件调用此 hook 获取用户状态
/**
 * Hook for managing authentication state
 * Wraps the shared AuthContext with auth-specific types
 */
export function useAuth(): UseAuthReturn {
  // 获取共享认证上下文
  const sharedAuth = useSharedAuth();
  // 获取认证服务实例
  const authService = getAuthService();

  // Convert shared auth to our auth-specific format
  // 封装登录方法，返回统一的 AuthResponse 格式
  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const result = await sharedAuth.login(credentials.username, credentials.password);
    return {
      success: result.success,
      user: sharedAuth.user,
      error: result.error,
    };
  }, [sharedAuth]);

  // 封装注册方法，返回统一的 AuthResponse 格式
  const register = useCallback(async (data: RegistrationData): Promise<AuthResponse> => {
    const result = await sharedAuth.register(data.username, data.password);
    return {
      success: result.success,
      user: sharedAuth.user,
      error: result.error,
    };
  }, [sharedAuth]);

  // 更新用户信息方法
  const updateUser = useCallback(async (updates: Partial<User>): Promise<void> => {
    await authService.updateUser(updates);
    // Refresh user from shared context after update
    // 更新后从共享上下文刷新用户数据
    await sharedAuth.login(sharedAuth.user?.username || '', '');
  }, [authService, sharedAuth]);

  // 刷新用户信息方法
  const refreshUser = useCallback(async (): Promise<void> => {
    await authService.refreshUser();
  }, [authService]);

  return {
    user: sharedAuth.user,
    // 用户存在即表示已认证
    isAuthenticated: !!sharedAuth.user,
    isLoading: sharedAuth.isLoading,
    needsSetup: sharedAuth.needsSetup,
    error: sharedAuth.error,
    login,
    logout: sharedAuth.logout,
    register,
    updateUser,
    refreshUser,
  };
}

// useUserRole Hook 返回值的类型定义
/**
 * Hook for user role checking
 */
export interface UseUserRoleReturn {
  user: User | null;
  hasRole: (role: User['role']) => boolean;
  isAdmin: boolean;
  isUser: boolean;
  isGuest: boolean;
}

/**
 * 用户角色检查 Hook
 * 提供便捷的角色判断方法
 */
export function useUserRole(): UseUserRoleReturn {
  const { user } = useSharedAuth();

  // 检查用户是否拥有指定角色
  const hasRole = useCallback((role: User['role']): boolean => {
    return user?.role === role;
  }, [user]);

  // 角色判断属性
  const isAdmin = hasRole('admin');
  // 管理员也是用户，所以包含 isAdmin
  const isUser = hasRole('user') || isAdmin;
  // 未登录或访客角色
  const isGuest = !user || hasRole('guest');

  return {
    user,
    hasRole,
    isAdmin,
    isUser,
    isGuest,
  };
}

// usePermissions Hook 返回值的类型定义
/**
 * Hook for user permissions
 */
export interface UsePermissionsReturn {
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canShare: boolean;
}

/**
 * 用户权限检查 Hook
 * 基于用户角色提供权限判断
 */
export function usePermissions(): UsePermissionsReturn {
  const { isAdmin, isUser } = useUserRole();

  // Admins have all permissions
  // Regular users have basic permissions
  // Guests have limited permissions
  // 管理员拥有所有权限
  // 普通用户拥有基本权限
  // 访客权限受限
  const canEdit = isAdmin || isUser;
  const canDelete = isAdmin;
  const canCreate = isAdmin || isUser;
  const canShare = isAdmin || isUser;

  return {
    canEdit,
    canDelete,
    canCreate,
    canShare,
  };
}

// useAuthStatus Hook 返回值的类型定义
/**
 * Hook for authentication status
 */
export interface UseAuthStatusReturn {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: Error | null;
}

/**
 * 认证状态检查 Hook
 * 提供详细的认证状态信息和错误处理
 */
export function useAuthStatus(): UseAuthStatusReturn {
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check for auth errors in localStorage or session storage
    // 检查 localStorage 中存储的认证错误
    try {
      const storedError = localStorage.getItem(AUTH_STORAGE_KEYS.ERROR);
      if (storedError) {
        setError(new Error(storedError));
        // 清除已读取的错误信息
        localStorage.removeItem(AUTH_STORAGE_KEYS.ERROR);
      }
    } catch {
      // Ignore localStorage errors
      // 忽略 localStorage 读取错误
    }
  }, []);

  // 根据加载和认证状态确定当前状态
  let status: UseAuthStatusReturn['status'] = 'idle';
  if (isLoading) {
    status = 'loading';
  } else if (isAuthenticated) {
    status = 'authenticated';
  } else {
    status = 'unauthenticated';
  }

  return { status, error };
}

// useUserSettings Hook 返回值的类型定义
/**
 * Hook for user settings
 */
export interface UseUserSettingsReturn {
  settings: User['settings'];
  updateSettings: (updates: Partial<User['settings']>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

/**
 * 用户设置管理 Hook
 * 提供用户设置的更新和重置功能
 */
export function useUserSettings(): UseUserSettingsReturn {
  const { user, updateUser } = useAuth();

  // 更新用户设置（部分更新）
  const updateSettings = useCallback(async (updates: Partial<User['settings']>) => {
    if (user) {
      // 合并现有设置和新设置
      await updateUser({ settings: { ...user.settings, ...updates } });
    }
  }, [user, updateUser]);

  // 重置用户设置为默认值
  const resetSettings = useCallback(async () => {
    await updateUser({ settings: {} });
  }, [updateUser]);

  return {
    settings: user?.settings,
    updateSettings,
    resetSettings,
  };
}
