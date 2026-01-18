/**
 * Auth Module Types
 *
 * Type definitions for authentication and authorization.
 */

// Import shared User type to avoid duplication
import type { User } from '@/shared/types/user.types';
export type { User };

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
 * Auth session
 */
export interface AuthSession {
  token?: string;
  user?: User;
  expiresAt?: Date;
  isAuthenticated: boolean;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegistrationData {
  username: string;
  password: string;
  email?: string;
}

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

/**
 * Login status
 */
export type LoginStatus = 'idle' | 'loading' | 'success' | 'error';
