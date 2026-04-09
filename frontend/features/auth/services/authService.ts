/**
 * Auth Service
 *
 * Service for authentication API calls and operations.
 */

import { t as translate } from '@/shared/i18n';
import type {
  User,
  LoginCredentials,
  RegistrationData,
  AuthResponse,
  AuthSession,
} from '../types';

/**
 * Auth service class
 */
export class AuthService {
  private baseUrl: string;
  private storageKey = 'auth_session';

  constructor(baseUrl: string = '/api/auth') {
    this.baseUrl = baseUrl;
  }

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: translate('auth.error.loginFailed') }));
        return {
          success: false,
          error: error.message || translate('auth.error.loginFailed'),
        };
      }

      const data = await response.json();
      const authResponse: AuthResponse = {
        success: true,
        user: data.user,
        token: data.token,
        message: data.message,
      };

      // Store session
      if (authResponse.token) {
        this.storeSession({
          token: authResponse.token,
          user: authResponse.user,
          isAuthenticated: true,
        });
      }

      return authResponse;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : translate('auth.error.networkError'),
      };
    }
  }

  /**
   * Register new user
   */
  async register(data: RegistrationData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: translate('auth.error.registrationFailed') }));
        return {
          success: false,
          error: error.message || translate('auth.error.registrationFailed'),
        };
      }

      const responseData = await response.json();
      const authResponse: AuthResponse = {
        success: true,
        user: responseData.user,
        token: responseData.token,
        message: responseData.message,
      };

      // Store session
      if (authResponse.token) {
        this.storeSession({
          token: authResponse.token,
          user: authResponse.user,
          isAuthenticated: true,
        });
      }

      return authResponse;
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : translate('auth.error.networkError'),
      };
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await fetch(`${this.baseUrl}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear session regardless of API call result
      this.clearSession();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    const session = this.getSession();
    return session?.user || null;
  }

  /**
   * Refresh user data
   */
  async refreshUser(): Promise<User | null> {
    try {
      const token = this.getToken();
      if (!token) {
        return null;
      }

      const response = await fetch(`${this.baseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Token might be expired, clear session
        this.clearSession();
        return null;
      }

      const user = await response.json();
      this.updateSessionUser(user);

      return user;
    } catch (error) {
      console.error('Refresh user error:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(updates: Partial<User>): Promise<User | null> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${this.baseUrl}/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      const updatedUser = await response.json();
      this.updateSessionUser(updatedUser);

      return updatedUser;
    } catch (error) {
      console.error('Update user error:', error);
      return null;
    }
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      return response.ok;
    } catch (error) {
      console.error('Change password error:', error);
      return false;
    }
  }

  /**
   * Reset password request
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/reset-password/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      return response.ok;
    } catch (error) {
      console.error('Request password reset error:', error);
      return false;
    }
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/reset-password/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      return response.ok;
    } catch (error) {
      console.error('Confirm password reset error:', error);
      return false;
    }
  }

  /**
   * Get stored session
   */
  getSession(): AuthSession | null {
    try {
      const sessionData = localStorage.getItem(this.storageKey);
      if (!sessionData) {
        return null;
      }

      const session: AuthSession = JSON.parse(sessionData);

      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        this.clearSession();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Store session
   */
  private storeSession(session: AuthSession): void {
    try {
      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const sessionWithExpiry: AuthSession = {
        ...session,
        expiresAt,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(sessionWithExpiry));
    } catch (error) {
      console.error('Store session error:', error);
    }
  }

  /**
   * Clear session
   */
  private clearSession(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Clear session error:', error);
    }
  }

  /**
   * Get token
   */
  getToken(): string | null {
    const session = this.getSession();
    return session?.token || null;
  }

  /**
   * Update session user
   */
  private updateSessionUser(user: User): void {
    try {
      const session = this.getSession();
      if (session) {
        const updatedSession: AuthSession = {
          ...session,
          user,
        };
        localStorage.setItem(this.storageKey, JSON.stringify(updatedSession));
      }
    } catch (error) {
      console.error('Update session user error:', error);
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    const session = this.getSession();
    return session?.isAuthenticated || false;
  }

  /**
   * Validate token
   */
  async validateToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/validate`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.clearSession();
        return false;
      }

      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }
}

/**
 * Singleton instance
 */
let authServiceInstance: AuthService | null = null;

/**
 * Get auth service singleton instance
 */
export function getAuthService(baseUrl?: string): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService(baseUrl);
  }
  return authServiceInstance;
}

/**
 * Reset auth service instance (useful for testing)
 */
export function resetAuthService(): void {
  authServiceInstance = null;
}
