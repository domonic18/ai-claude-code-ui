/**
 * User Types
 *
 * Type definitions for user-related data.
 */

/**
 * User role enum
 */
export type UserRole = 'admin' | 'user' | 'guest';

// UserSettings 的类型定义
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

// 用户信息的类型定义
/**
 * User profile
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  role?: UserRole;
  settings?: UserSettings;
  createdAt?: Date;
  lastLogin?: Date;
}

// UserCredentials 的类型定义
/**
 * User credentials
 */
export interface UserCredentials {
  username: string;
  password: string;
}

// AuthSession 的类型定义
/**
 * Authentication session
 */
export interface AuthSession {
  user: User;
  token?: string;
  expiresAt?: Date;
  isAuthenticated: boolean;
}

// UserPreferences 的类型定义
/**
 * User preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  autoSave: boolean;
  [key: string]: any;
}
