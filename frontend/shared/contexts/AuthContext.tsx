import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/shared/services';
import type { User } from '@/shared/types';

export interface AuthResult {
  success: boolean;
  error?: string;
}

export interface AuthContextValue {
  user: User | null;
  login: (username: string, password: string) => Promise<AuthResult>;
  register: (username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  isLoading: boolean;
  needsSetup: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState<boolean>(false);

  useEffect(() => {
    if (import.meta.env.VITE_IS_PLATFORM === 'true') {
      setUser({ username: 'platform-user', id: 'platform' });
      setNeedsSetup(false);
      setIsLoading(false);
      setHasChecked(true);
      return;
    }

    // 不再在应用启动时自动检查认证状态
    // 只在需要时（访问受保护页面）才检查
    setIsLoading(false);
    setHasChecked(true);
  }, []);

  const checkAuthStatus = async () => {
    // 如果已经检查过，且用户已登录，则不再重复检查
    if (hasChecked && user) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const statusResponse = await api.auth.status();
      const statusData = await statusResponse.json();

      if (statusData.data?.needsSetup) {
        setNeedsSetup(true);
        setHasChecked(true);
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
          // 401 是正常的未登录状态，不需要显示错误
          setUser(null);
        }
      } catch (err) {
        // 网络错误时静默处理
        setUser(null);
      }
    } catch (err) {
      // 只在真正的错误时才记录
      console.error('Auth status check failed:', err);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
      setHasChecked(true);
    }
  };

  const login = async (username: string, password: string): Promise<AuthResult> => {
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
      console.error('Login error:', err);
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (username: string, password: string): Promise<AuthResult> => {
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
      console.error('Registration error:', err);
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    setUser(null);
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout endpoint error:', err);
    }
  };

  const value: AuthContextValue = {
    user,
    login,
    register,
    logout,
    checkAuthStatus,
    isLoading,
    needsSetup,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
