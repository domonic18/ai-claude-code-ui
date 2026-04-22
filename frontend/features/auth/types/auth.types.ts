/**
 * Auth Module Types
 *
 * Type definitions for authentication and authorization.
 */

// Import shared User type to avoid duplication
import type { User } from '@/shared/types/user.types';
export type { User };

// 用户个性化设置的类型定义，由 useUserSettings Hook 使用
/**
 * User settings
 */
export interface UserSettings {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
  notifications?: boolean;
  autoSave?: boolean;
}

// 认证会话的类型定义，由 AuthContext 使用
/**
 * Auth session
 */
export interface AuthSession {
  token?: string;
  user?: User;
  expiresAt?: Date;
  isAuthenticated: boolean;
}

// 登录凭据的类型定义，由 LoginForm 组件使用
/**
 * Login credentials
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

// 注册数据的类型定义，由 SetupForm 组件使用
/**
 * Registration data
 */
export interface RegistrationData {
  username: string;
  password: string;
  email?: string;
}

// 认证响应的类型定义，由 authService 返回
/**
 * Auth response
 */
export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  error?: string;
}

// LoginModal 组件的属性类型定义
/**
 * Login modal props
 */
export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'claude' | 'cursor' | 'codex';
  project?: {
    name: string;
    path: string;
    displayName?: string;
  };
  onComplete?: (exitCode: number) => void;
}

// AuthContext 提供的值类型定义
/**
 * Auth context value
 */
export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  register: (data: RegistrationData) => Promise<AuthResponse>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// 登录状态的类型定义
/**
 * Login status
 */
export type LoginStatus = 'idle' | 'loading' | 'success' | 'error';
