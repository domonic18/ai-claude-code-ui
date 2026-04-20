/**
 * Authentication Token Manager
 *
 * Manages JWT token storage, validation, and session lifecycle.
 * Handles localStorage operations with expiration checking.
 *
 * @module features/auth/services/authTokenManager
 */

import type { User, AuthSession } from '../types';
import { logger } from '@/shared/utils/logger';

const DEFAULT_STORAGE_KEY = 'auth_session';
const SESSION_EXPIRY_HOURS = 24;

/**
 * Create token manager
 *
 * @param {string} storageKey - localStorage key for session
 * @returns {Object} Token manager interface
 */
export function createTokenManager(storageKey: string = DEFAULT_STORAGE_KEY) {
  /**
   * Get stored session
   *
   * @returns {AuthSession | null} Session object or null
   */
  function getSession(): AuthSession | null {
    try {
      const sessionData = localStorage.getItem(storageKey);
      if (!sessionData) {
        return null;
      }

      const session: AuthSession = JSON.parse(sessionData);

      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        clearSession();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Store session
   *
   * @param {AuthSession} session - Session to store
   */
  function storeSession(session: AuthSession): void {
    try {
      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

      const sessionWithExpiry: AuthSession = {
        ...session,
        expiresAt,
      };

      localStorage.setItem(storageKey, JSON.stringify(sessionWithExpiry));
    } catch (error) {
      logger.error('Store session error:', error);
    }
  }

  /**
   * Clear session
   */
  function clearSession(): void {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      logger.error('Clear session error:', error);
    }
  }

  /**
   * Get token
   *
   * @returns {string | null} JWT token or null
   */
  function getToken(): string | null {
    const session = getSession();
    return session?.token || null;
  }

  /**
   * Get current user
   *
   * @returns {User | null} User object or null
   */
  function getCurrentUser(): User | null {
    const session = getSession();
    return session?.user || null;
  }

  /**
   * Update session user
   *
   * @param {User} user - Updated user data
   */
  function updateSessionUser(user: User): void {
    try {
      const session = getSession();
      if (session) {
        const updatedSession: AuthSession = {
          ...session,
          user,
        };
        localStorage.setItem(storageKey, JSON.stringify(updatedSession));
      }
    } catch (error) {
      logger.error('Update session user error:', error);
    }
  }

  /**
   * Check if authenticated
   *
   * @returns {boolean} Authentication status
   */
  function isAuthenticated(): boolean {
    const session = getSession();
    return session?.isAuthenticated || false;
  }

  return {
    getSession,
    storeSession,
    clearSession,
    getToken,
    getCurrentUser,
    updateSessionUser,
    isAuthenticated,
  };
}
