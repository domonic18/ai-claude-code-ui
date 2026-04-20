/**
 * Password Operations
 *
 * Handles password reset and change operations.
 *
 * @module features/auth/services/authPasswordOperations
 */

import { t as translate } from '@/shared/i18n';
import { logger } from '@/shared/utils/logger';

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
