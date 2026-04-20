/**
 * Auth Service
 *
 * Main authentication service that composes operations and token management.
 * Provides a clean API for authentication operations.
 *
 * @module features/auth/services/authService
 */

import type {
  User,
  LoginCredentials,
  RegistrationData,
  AuthResponse,
} from '../types';
import {
  executeLogin,
  executeRegister,
  executeLogout,
  changePassword,
  requestPasswordReset,
  confirmPasswordReset,
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
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return executeLogin(this.baseUrl, credentials, this.tokenManager.storeSession);
  }

  /**
   * Register new user
   */
  async register(data: RegistrationData): Promise<AuthResponse> {
    return executeRegister(this.baseUrl, data, this.tokenManager.storeSession);
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
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    return changePassword(this.baseUrl, this.tokenManager.getToken, oldPassword, newPassword);
  }

  /**
   * Reset password request
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    return requestPasswordReset(this.baseUrl, email);
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<boolean> {
    return confirmPasswordReset(this.baseUrl, token, newPassword);
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
