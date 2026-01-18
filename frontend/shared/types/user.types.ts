/**
 * User Types
 *
 * Type definitions for user-related data.
 */

/**
 * User profile
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  createdAt?: string;
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
  expiresAt?: string;
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
