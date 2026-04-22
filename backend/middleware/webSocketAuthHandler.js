/**
 * webSocketAuthHandler.js
 *
 * WebSocket authentication handler
 *
 * @module middleware/webSocketAuthHandler
 */

import jwt from 'jsonwebtoken';
import { repositories } from '../database/db.js';
import { AUTH, SERVER } from '../config/config.js';
import { AuthType } from './authStrategies.js';
import { handlePlatformAuth } from './platformAuthHandler.js';

const { User } = repositories;

// 中间件函数，在请求处理链中执行
/**
 * Handle WebSocket platform authentication
 * @returns {Object|null} User info or null
 */
function handleWebSocketPlatformAuth() {
  const req = { user: null };
  const result = handlePlatformAuth(req, () => {}, false);
  if (result) {
    return null;
  }
  if (req.user) {
    return { userId: req.user.userId, username: req.user.username, authType: AuthType.PLATFORM };
  }
  return null;
}

// 中间件函数，在请求处理链中执行
/**
 * Handle WebSocket JWT authentication
 * @param {string} token - JWT token
 * @returns {Object|null} User info or null
 */
function handleWebSocketJwtAuth(token) {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, AUTH.jwtSecret);
    const user = User.getById(decoded.userId);

    if (!user) {
      return null;
    }

    return { userId: user.id, username: user.username, authType: AuthType.JWT };
  } catch (error) {
    return null;
  }
}

// 中间件函数，在请求处理链中执行
/**
 * Authenticate WebSocket connection
 * @param {string} token - JWT token
 * @returns {Object|null} User info or null
 */
export function authenticateWebSocket(token) {
  // 平台模式
  if (SERVER.isPlatform) {
    return handleWebSocketPlatformAuth();
  }

  return handleWebSocketJwtAuth(token);
}

