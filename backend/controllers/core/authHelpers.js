/**
 * Authentication Helpers
 *
 * Helper functions for authentication controller.
 * Extracted from AuthController.js to reduce complexity.
 *
 * @module controllers/core/authHelpers
 */

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
