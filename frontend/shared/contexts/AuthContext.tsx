/**
 * Auth Context
 *
 * 提供全局认证状态和方法（登录、注册、登出、状态检查）。
 *
 * ## 调用时序
 * 1. App 启动 → AuthProvider 挂载
 * 2. useEffect 触发 → checkAuthStatus() 检查登录状态
 * 3. 检查完成 → 设置 user/needsSetup 状态
 * 4. 子组件通过 useAuth() 获取状态并决定渲染内容
 *
 * ## 请求去重
 * 使用 requestDeduplicator 防止 React StrictMode 导致的双重请求
 */

import React, { createContext, useContext, useState } from 'react';
import type { User } from '@/shared/types';
import {
  useAuthStatusCheck,
  createLoginOperation,
  createRegisterOperation,
  createLogoutOperation
} from './authOperations';

export interface AuthResult {
  success: boolean;
  error?: string;
}

export interface AuthContextValue {
  user: User | null;
  login: (username: string, password: string) => Promise<AuthResult>;
  register: (username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  checkAuthStatus: (force?: boolean) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState<boolean>(true); // 初始为 true，防止闪烁
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 使用提取的钩子和操作创建器
  const checkAuthStatus = useAuthStatusCheck(setUser, setIsLoading, setNeedsSetup, setError);
  const login = createLoginOperation(setUser, setError);
  const register = createRegisterOperation(setUser, setNeedsSetup, setError);
  const logout = createLogoutOperation(setUser);

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
