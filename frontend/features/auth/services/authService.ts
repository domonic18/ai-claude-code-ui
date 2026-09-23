/**
 * Auth Service
 *
 * Main authentication service that composes operations and token management.
 * Provides a clean API for authentication operations.
 * 认证方式：仅 SAML SSO（登录/注册由 IdP 回调完成，此处仅保留会话与用户资料操作）。
 *
 * @module features/auth/services/authService
 */

import type { User } from '../types';
import {
  executeLogout,
  refreshUser,
  updateUser,
  validateToken,
} from './authOperations';
import { createTokenManager } from './authTokenManager';

/**
 * Auth service class
 */
export class AuthService {
  private baseUrl: string;
  private storageKey = 'auth_session';
  private tokenManager: ReturnType<typeof createTokenManager>;

  constructor(baseUrl: string = '/api/auth') {
    this.baseUrl = baseUrl;
    this.tokenManager = createTokenManager(this.storageKey);
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    return executeLogout(this.baseUrl, this.tokenManager.getToken, this.tokenManager.clearSession);
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    return this.tokenManager.getCurrentUser();
  }

  /**
   * Refresh user data
   */
  async refreshUser(): Promise<User | null> {
    return refreshUser(
      this.baseUrl,
      this.tokenManager.getToken,
      this.tokenManager.clearSession,
      this.tokenManager.updateSessionUser
    );
  }

  /**
   * Update user profile
   */
  async updateUser(updates: Partial<User>): Promise<User | null> {
    return updateUser(
      this.baseUrl,
      this.tokenManager.getToken,
      this.tokenManager.updateSessionUser,
      updates
    );
  }

  /**
   * Get stored session
   */
  getSession() {
    return this.tokenManager.getSession();
  }

  /**
   * Get token
   */
  getToken(): string | null {
    return this.tokenManager.getToken();
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.tokenManager.isAuthenticated();
  }

  /**
   * Validate token
   */
  async validateToken(): Promise<boolean> {
    return validateToken(this.baseUrl, this.tokenManager.getToken, this.tokenManager.clearSession);
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
