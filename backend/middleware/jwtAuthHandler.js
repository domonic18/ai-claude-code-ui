/**
 * jwtAuthHandler.js
 *
 * JWT authentication handler
 *
 * @module middleware/jwtAuthHandler
 */

import jwt from 'jsonwebtoken';
import { repositories } from '../database/db.js';
import { AUTH } from '../config/config.js';
import { AuthType, _checkRoles } from './authStrategies.js';

const { User } = repositories;

// 中间件函数，在请求处理链中执行
/**
 * Verify JWT token and return user
 * @param {string} token - JWT token
 * @returns {Object|null} User object or null
 */
function verifyJwtToken(token) {
  try {
    const decoded = jwt.verify(token, AUTH.jwtSecret);
    const user = User.getById(decoded.userId);
    return user || null;
  } catch (error) {
    return null;
  }
}

// 中间件函数，在请求处理链中执行
/**
 * Extract token from authorization header
 * @param {Object} headers - Request headers
 * @returns {string|null} Token or null
 */
function extractToken(headers) {
  const authHeader = headers['authorization'];
  if (!authHeader) return null;
  return authHeader.split(' ')[1];
}

// 中间件函数，在请求处理链中执行
/**
 * Handle JWT authentication for API routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {boolean} optional - Whether authentication is optional
 * @param {Array<string>} requiredRoles - Required roles
 * @returns {boolean} True if authentication should continue
 */
export function handleJwtAuth(req, res, next, optional = false, requiredRoles = []) {
  const token = extractToken(req.headers);

  if (!token) {
    if (optional) {
      req.user = null;
      return next();
    }
    return res.status(401).json({
      error: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }

  const user = verifyJwtToken(token);
  if (!user) {
    if (optional) {
      req.user = null;
      return next();
    }
    return res.status(401).json({
      error: 'Invalid token. User not found.',
      code: 'USER_NOT_FOUND'
    });
  }

  req.user = {
    ...user,
    userId: user.id,
    authType: AuthType.JWT
  };

  return _checkRoles(req, res, next, requiredRoles);
}

export { verifyJwtToken, extractToken };

