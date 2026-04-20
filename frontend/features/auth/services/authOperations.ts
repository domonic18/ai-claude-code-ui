/**
 * Authentication Operations
 *
 * Handles authentication API calls: login, register, logout,
 * password management, and user profile operations.
 *
 * @module features/auth/services/authOperations
 */

import { t as translate } from '@/shared/i18n';
import type {
  User,
  LoginCredentials,
  RegistrationData,
  AuthResponse,
} from '../types';
import { logger } from '@/shared/utils/logger';

/**
 * Execute login operation
 *
 * @param {string} baseUrl - Base API URL
 * @param {LoginCredentials} credentials - User credentials
 * @param {Function} storeSession - Session storage function
 * @returns {Promise<AuthResponse>} Login response
 */
export async function executeLogin(
  baseUrl: string,
  credentials: LoginCredentials,
  storeSession: (session: any) => void
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${baseUrl}/login`, {
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
      storeSession({
        token: authResponse.token,
        user: authResponse.user,
        isAuthenticated: true,
      });
    }

    return authResponse;
  } catch (error) {
    logger.error('Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : translate('auth.error.networkError'),
    };
  }
}

/**
 * Execute registration operation
 *
 * @param {string} baseUrl - Base API URL
 * @param {RegistrationData} data - Registration data
 * @param {Function} storeSession - Session storage function
 * @returns {Promise<AuthResponse>} Registration response
 */
export async function executeRegister(
  baseUrl: string,
  data: RegistrationData,
  storeSession: (session: any) => void
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${baseUrl}/register`, {
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
      storeSession({
        token: authResponse.token,
        user: authResponse.user,
        isAuthenticated: true,
      });
    }

    return authResponse;
  } catch (error) {
    logger.error('Registration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : translate('auth.error.networkError'),
    };
  }
}

/**
 * Execute logout operation
 *
 * @param {string} baseUrl - Base API URL
 * @param {Function} getToken - Token getter function
 * @param {Function} clearSession - Session clearer function
 * @returns {Promise<void>}
 */
export async function executeLogout(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void
): Promise<void> {
  try {
    const token = getToken();
    if (token) {
      await fetch(`${baseUrl}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    logger.error('Logout error:', error);
  } finally {
    // Clear session regardless of API call result
    clearSession();
  }
}

/**
 * Change user password
 *
 * @param {string} baseUrl - Base API URL
 * @param {Function} getToken - Token getter function
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
export async function changePassword(
  baseUrl: string,
  getToken: () => string | null,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  try {
    const token = getToken();
    if (!token) {
      return false;
    }

    const response = await fetch(`${baseUrl}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    return response.ok;
  } catch (error) {
    logger.error('Change password error:', error);
    return false;
  }
}

/**
 * Request password reset
 *
 * @param {string} baseUrl - Base API URL
 * @param {string} email - User email
 * @returns {Promise<boolean>} Success status
 */
export async function requestPasswordReset(
  baseUrl: string,
  email: string
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/reset-password/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    return response.ok;
  } catch (error) {
    logger.error('Request password reset error:', error);
    return false;
  }
}

/**
 * Confirm password reset
 *
 * @param {string} baseUrl - Base API URL
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
export async function confirmPasswordReset(
  baseUrl: string,
  token: string,
  newPassword: string
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/reset-password/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });

    return response.ok;
  } catch (error) {
    logger.error('Confirm password reset error:', error);
    return false;
  }
}

/**
 * Refresh user data from server
 *
 * @param {string} baseUrl - Base API URL
 * @param {Function} getToken - Token getter function
 * @param {Function} clearSession - Session clearer function
 * @param {Function} updateSessionUser - Session updater function
 * @returns {Promise<User | null>} Updated user or null
 */
export async function refreshUser(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void,
  updateSessionUser: (user: User) => void
): Promise<User | null> {
  try {
    const token = getToken();
    if (!token) {
      return null;
    }

    const response = await fetch(`${baseUrl}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token might be expired, clear session
      clearSession();
      return null;
    }

    const user = await response.json();
    updateSessionUser(user);

    return user;
  } catch (error) {
    logger.error('Refresh user error:', error);
    return null;
  }
}

/**
 * Update user profile
 *
 * @param {string} baseUrl - Base API URL
 * @param {Function} getToken - Token getter function
 * @param {Function} updateSessionUser - Session updater function
 * @param {Partial<User>} updates - User updates
 * @returns {Promise<User | null>} Updated user or null
 */
export async function updateUser(
  baseUrl: string,
  getToken: () => string | null,
  updateSessionUser: (user: User) => void,
  updates: Partial<User>
): Promise<User | null> {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${baseUrl}/me`, {
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
    updateSessionUser(updatedUser);

    return updatedUser;
  } catch (error) {
    logger.error('Update user error:', error);
    return null;
  }
}

/**
 * Validate token with server
 *
 * @param {string} baseUrl - Base API URL
 * @param {Function} getToken - Token getter function
 * @param {Function} clearSession - Session clearer function
 * @returns {Promise<boolean>} Valid status
 */
export async function validateToken(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void
): Promise<boolean> {
  try {
    const token = getToken();
    if (!token) {
      return false;
    }

    const response = await fetch(`${baseUrl}/validate`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      clearSession();
      return false;
    }

    return true;
  } catch {
    clearSession();
    return false;
  }
}
