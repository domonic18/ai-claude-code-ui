/**
 * Auth Module Types
 *
 * Type definitions for authentication and authorization.
 * 认证方式：仅 SAML SSO（密码登录/注册相关类型已移除）。
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
