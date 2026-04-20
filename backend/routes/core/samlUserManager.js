/**
 * SAML User Management Utilities
 *
 * SAML 用户管理工具 - 处理用户信息提取和用户查找/创建
 *
 * @module routes/core/samlUserManager
 */

import { repositories } from '../../database/db.js';
import { generateToken } from '../../middleware/auth.middleware.js';
import containerManager from '../../services/container/core/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/core/samlUserManager');
const { User } = repositories;

// ─── SAML 属性映射 ──────────────────────────────────────────

/**
 * SAML 属性候选名映射表
 * 每个 UI 字段对应多个可能的 SAML 属性名，取第一个有值的
 */
const ATTRIBUTE_MAPPINGS = {
  email: ['email', 'mail', 'username'],
  firstName: ['firstName', 'givenname', 'first_name'],
  lastName: ['lastName', 'sn', 'last_name'],
  displayName: ['displayName', 'display_name', 'name', 'username'],
};

/**
 * 从 SAML 属性中提取第一个有效值
 * @param {Object} attributes - SAML 属性（数组格式）
 * @param {string[]} candidates - 候选属性名列表
 * @param {string} fallback - 默认值
 * @returns {string} 提取的值
 */
function extractAttribute(attributes, candidates, fallback = '') {
  for (const name of candidates) {
    if (attributes[name]?.[0]) return attributes[name][0];
  }
  return fallback;
}

/**
 * 从 SAML 响应中提取用户信息
 * @param {Object} spResponse - saml2-js 解析后的响应
 * @returns {Object} { externalId, email, firstName, lastName, displayName }
 */
function extractUserInfo(spResponse) {
  const samlUser = spResponse.user || {};
  const externalId = samlUser.name_id;
  const attributes = samlUser.attributes || {};

  const email = extractAttribute(attributes, ATTRIBUTE_MAPPINGS.email, externalId);
  const firstName = extractAttribute(attributes, ATTRIBUTE_MAPPINGS.firstName, '');
  const lastName = extractAttribute(attributes, ATTRIBUTE_MAPPINGS.lastName, '');
  const displayName = extractAttribute(attributes, ATTRIBUTE_MAPPINGS.displayName, '')
    || `${firstName} ${lastName}`.trim()
    || email;

  return { externalId, email, firstName, lastName, displayName };
}

/**
 * 查找或创建 SAML 用户
 * @param {string} externalId - SAML NameID
 * @param {Object} profile - 用户属性
 * @returns {Promise<Object|null>} 用户对象，失败时返回 null（并已发送响应）
 */
async function findOrCreateUser(externalId, profile) {
  let user = User.getByExternalId(externalId);

  if (user) {
    if (user.identity_provider && user.identity_provider !== 'saml') {
      // 这里无法直接返回 res 响应，调用方需要处理
      throw Object.assign(new Error('User already exists with a different authentication method'), {
        statusCode: 400,
        code: 'IDENTITY_PROVIDER_CONFLICT',
        details: { existing_provider: user.identity_provider, requested_provider: 'saml' },
      });
    }
    User.updateLastLogin(user.id);
    return user;
  }

  try {
    return User.createWithSSO({
      username: profile.email,
      email: profile.email,
      identity_provider: 'saml',
      external_id: externalId,
      first_name: profile.firstName,
      last_name: profile.lastName,
      display_name: profile.displayName,
    });
  } catch (dbError) {
    logger.error('[SAML] Failed to create user:', dbError);
    throw Object.assign(new Error('Failed to create user'), {
      statusCode: 500,
      code: 'USER_CREATION_FAILED',
    });
  }
}

/**
 * 设置认证 Cookie
 * @param {Object} res - Express 响应对象
 * @param {Object} user - 用户对象
 */
function setAuthCookie(res, user) {
  const token = generateToken({ id: user.id, username: user.username });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/',
  };

  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  res.cookie('auth_token', token, cookieOptions);
}

/**
 * 异步创建用户容器（不阻塞登录流程）
 * @param {Object} user - 用户对象
 */
function initiateContainerCreation(user) {
  containerManager.getOrCreateContainer(user.id)
    .then(() => logger.info(`[SAML] Container ready for user ${user.id}`))
    .catch(err => logger.error(`[SAML] Failed to create container for user ${user.id}:`, err.message));
}

/**
 * 重定向到前端
 * @param {Object} res - Express 响应对象
 */
function redirectToFrontend(res) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173/chat';
  const redirectUrl = new URL(frontendUrl);
  redirectUrl.searchParams.set('saml', 'success');
  return res.redirect(redirectUrl.toString());
}

export {
  extractUserInfo,
  findOrCreateUser,
  setAuthCookie,
  initiateContainerCreation,
  redirectToFrontend,
};
