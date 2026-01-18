/**
 * Auth Hooks
 *
 * Custom hooks for authentication functionality.
 * These hooks wrap the shared AuthContext and provide additional utilities.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth as useSharedAuth } from '@/shared/contexts/AuthContext';
import { getAuthService } from '../services';
import type {
  User,
  LoginCredentials,
  RegistrationData,
  AuthResponse,
} from '../types';

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

/**
 * Hook for managing authentication state
 * Wraps the shared AuthContext with auth-specific types
 */
export function useAuth(): UseAuthReturn {
  const sharedAuth = useSharedAuth();
  const authService = getAuthService();

  // Convert shared auth to our auth-specific format
  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const result = await sharedAuth.login(credentials.username, credentials.password);
    return {
      success: result.success,
      user: sharedAuth.user,
      error: result.error,
    };
  }, [sharedAuth]);

  const register = useCallback(async (data: RegistrationData): Promise<AuthResponse> => {
    const result = await sharedAuth.register(data.username, data.password);
    return {
      success: result.success,
      user: sharedAuth.user,
      error: result.error,
    };
  }, [sharedAuth]);

  const updateUser = useCallback(async (updates: Partial<User>): Promise<void> => {
    await authService.updateUser(updates);
    // Refresh user from shared context after update
    await sharedAuth.login(sharedAuth.user?.username || '', '');
  }, [authService, sharedAuth]);

  const refreshUser = useCallback(async (): Promise<void> => {
    await authService.refreshUser();
  }, [authService]);

  return {
    user: sharedAuth.user,
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

export function useUserRole(): UseUserRoleReturn {
  const { user } = useSharedAuth();

  const hasRole = useCallback((role: User['role']): boolean => {
    return user?.role === role;
  }, [user]);

  const isAdmin = hasRole('admin');
  const isUser = hasRole('user') || isAdmin;
  const isGuest = !user || hasRole('guest');

  return {
    user,
    hasRole,
    isAdmin,
    isUser,
    isGuest,
  };
}

/**
 * Hook for user permissions
 */
export interface UsePermissionsReturn {
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canShare: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { isAdmin, isUser } = useUserRole();

  // Admins have all permissions
  // Regular users have basic permissions
  // Guests have limited permissions
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

/**
 * Hook for authentication status
 */
export interface UseAuthStatusReturn {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: Error | null;
}

export function useAuthStatus(): UseAuthStatusReturn {
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check for auth errors in localStorage or session storage
    try {
      const storedError = localStorage.getItem('authError');
      if (storedError) {
        setError(new Error(storedError));
        localStorage.removeItem('authError');
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

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

/**
 * Hook for user settings
 */
export interface UseUserSettingsReturn {
  settings: User['settings'];
  updateSettings: (updates: Partial<User['settings']>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export function useUserSettings(): UseUserSettingsReturn {
  const { user, updateUser } = useAuth();

  const updateSettings = useCallback(async (updates: Partial<User['settings']>) => {
    if (user) {
      await updateUser({ settings: { ...user.settings, ...updates } });
    }
  }, [user, updateUser]);

  const resetSettings = useCallback(async () => {
    await updateUser({ settings: {} });
  }, [updateUser]);

  return {
    settings: user?.settings,
    updateSettings,
    resetSettings,
  };
}
