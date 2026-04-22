/**
 * Authentication Helpers
 *
 * Helper functions for authentication controller.
 * Extracted from AuthController.js to reduce complexity.
 *
 * @module controllers/core/authHelpers
 */

import { ValidationError } from '../../middleware/error-handler.middleware.js';
import { SESSION_TIMEOUTS } from '../../config/config.js';

// 获取资源，供路由层调用
/**
 * Get Cookie configuration options
 * Ensures the same configuration is used for setting and clearing cookies
 * @returns {Object} Cookie configuration options
 */
export function getCookieOptions() {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: SESSION_TIMEOUTS.cookieMaxAge,
    path: '/'
  };

  // Only set domain in production and if configured
  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  return cookieOptions;
}

// 处理业务逻辑，供路由层调用
/**
 * Validate user credentials
 * @param {string} username - Username
 * @param {string} password - Password
 * @throws {ValidationError} If validation fails
 */
export function validateCredentials(username, password) {
  if (!username || !password) {
    throw new ValidationError('Username and password are required');
  }

  if (username.length < 3) {
    throw new ValidationError('Username must be at least 3 characters');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }
}

// 处理业务逻辑，供路由层调用
/**
 * Validate password change request
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @throws {ValidationError} If validation fails
 */
export function validatePasswordChange(currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ValidationError('New password must be at least 6 characters');
  }
}

// 处理业务逻辑，供路由层调用
/**
 * Build user response object
 * @param {Object} user - User object
 * @returns {Object} User response
 */
export function buildUserResponse(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

