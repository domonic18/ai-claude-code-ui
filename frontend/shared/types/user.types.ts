/**
 * User Types
 *
 * Type definitions for user-related data.
 */

/**
 * User role enum
 */
export type UserRole = 'admin' | 'user' | 'guest';

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

/**
 * User credentials
 */
export interface UserCredentials {
  username: string;
  password: string;
}

/**
 * Authentication session
 */
export interface AuthSession {
  user: User;
  token?: string;
  expiresAt?: Date;
  isAuthenticated: boolean;
}

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
