/**
 * SAML Authentication Routes
 *
 * SAML 单点登录路由 - 使用 saml2-js 实现
 *
 * @module routes/core/saml
 */

import { Router } from 'express';
import { samlConfig, validateSamlConfig } from '../../config/saml.config.js';
import { generateToken } from '../../middleware/auth.middleware.js';
import containerManager from '../../services/container/core/index.js';
import { repositories } from '../../database/db.js';
import saml2 from 'saml2-js';
import { createLogger } from '../../utils/logger.js';
const logger = createLogger('routes/core/saml');

const { User } = repositories;
const { ServiceProvider: Saml, IdentityProvider: IdP } = saml2;

const router = Router();

// ─── 证书解析工具 ──────────────────────────────────────────

/**
 * 从 PEM 格式字符串中移除 BEGIN/END 标记和空白
 * @param {string} pem - PEM 格式的证书或密钥
 * @returns {string|null} 清理后的 base64 内容
 */
function stripPemHeaders(pem) {
  if (!pem) return null;
  return pem
    .replace(/-----BEGIN [\s\S]+?-----/g, '')
    .replace(/-----END [\s\S]+?-----/g, '')
    .replace(/\s/g, '');
}

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

// ─── SAML 实例创建 ──────────────────────────────────────────

/**
 * 创建 SAML SP/IdP 实例
 * @returns {{ sp: Object, idp: Object }|null}
 */
function createSamlInstances() {
  if (!samlConfig.enabled) return null;

  const validation = validateSamlConfig();
  if (!validation.valid) {
    throw new Error(`SAML configuration invalid: ${validation.errors.join('; ')}`);
  }

  try {
    const idpCert = stripPemHeaders(samlConfig.certificate);
    const spPrivateKey = stripPemHeaders(samlConfig.spPrivateKey);
    const spCert = stripPemHeaders(samlConfig.spCertificate);

    const idp = new IdP({
      sso_login_url: samlConfig.sso_url,
      sso_logout_url: samlConfig.slo_url,
      certificates: [idpCert],
      entity_id: samlConfig.entity_id,
    });

    const spConfig = {
      entity_id: samlConfig.issuer,
      assert_endpoint: samlConfig.callbackUrl,
      allow_unencrypted_assertion: true,
    };

    if (spPrivateKey && spCert) {
      spConfig.private_key = spPrivateKey;
      spConfig.certificate = spCert;
    }

    return { sp: new Saml(spConfig), idp };
  } catch (error) {
    logger.error('[SAML] Failed to create SAML instances:', error);
    return null;
  }
}

// ─── SAML 禁用检查 ──────────────────────────────────────────

/** 返回 SAML 禁用的标准响应 */
function samlDisabledResponse(res) {
  return res.status(404).json({ error: 'SAML authentication is not enabled', code: 'SAML_DISABLED' });
}

// ─── 路由 ──────────────────────────────────────────────────

router.post('/init', (req, res) => {
  if (!samlConfig.enabled) return samlDisabledResponse(res);

  const { return_to } = req.body;
  if (!return_to) {
    return res.status(400).json({ error: 'return_to parameter is required', code: 'MISSING_RETURN_TO' });
  }

  let baseUrl = samlConfig.issuer;
  if (!baseUrl || baseUrl === 'http://localhost:5173') {
    baseUrl = `${req.protocol}://${req.get('host')}/api/auth/saml`;
  }

  return res.json({ login_url: `${baseUrl}/sso-login`, return_to });
});

router.get('/sso-login', async (req, res) => {
  if (!samlConfig.enabled) return samlDisabledResponse(res);

  try {
    const instances = createSamlInstances();
    if (!instances) throw new Error('Failed to create SAML instances');

    const url = await new Promise((resolve, reject) => {
      instances.sp.create_login_request_url(instances.idp, {}, (err, loginUrl) => {
        if (err) reject(err);
        else resolve(loginUrl);
      });
    });

    return res.redirect(url);
  } catch (error) {
    logger.error('[SAML] Error creating login request:', error);
    return res.status(500).json({ error: 'Failed to create SAML login request', message: error.message });
  }
});

router.post('/callback', async (req, res) => {
  if (!samlConfig.enabled) return samlDisabledResponse(res);
  if (!req.body.SAMLResponse) {
    return res.status(400).json({ error: 'SAMLResponse is required', code: 'MISSING_SAML_RESPONSE' });
  }

  try {
    const instances = createSamlInstances();
    if (!instances) throw new Error('Failed to create SAML instances');

    // 验证 SAML Response
    const spResponse = await new Promise((resolve, reject) => {
      instances.sp.post_assert(instances.idp, { request_body: req.body }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });

    // 提取用户信息
    const { externalId, email, firstName, lastName, displayName } = extractUserInfo(spResponse);
    if (!externalId) {
      return res.status(400).json({
        error: 'SAML Response missing NameID',
        code: 'MISSING_NAMEID',
        details: process.env.NODE_ENV === 'development' ? { response: spResponse } : undefined,
      });
    }

    // 查找或创建用户
    const user = await findOrCreateUser(externalId, { email, firstName, lastName, displayName });
    if (!user) return; // findOrCreateUser 已发送错误响应

    // 设置认证 cookie 并重定向
    setAuthCookie(res, user);
    initiateContainerCreation(user);
    redirectToFrontend(res);

  } catch (error) {
    logger.error('[SAML] Error during callback processing:', error);
    return res.status(500).json({
      error: 'SAML callback processing failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

router.post('/sso-callback', async (req, res, next) => {
  req.url = '/callback';
  return router.handle(req, res, next);
});

router.get('/logout', (req, res) => {
  if (!samlConfig.enabled) return samlDisabledResponse(res);

  res.clearCookie('auth_token', { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/' });
  return res.redirect(samlConfig.slo_url || '/login?logged_out=true');
});

router.get('/metadata', (req, res) => {
  if (!samlConfig.enabled) return samlDisabledResponse(res);

  const instances = createSamlInstances();
  if (!instances) {
    return res.status(500).json({ error: 'SAML instances not initialized' });
  }

  res.set('Content-Type', 'application/xml');
  res.send(instances.sp.create_metadata());
});

router.get('/status', (_req, res) => {
  res.json({
    enabled: samlConfig.enabled,
    configured: !!samlConfig.certificate && samlConfig.certificate.length > 100,
    issuer: samlConfig.issuer,
    entryPoint: samlConfig.sso_url,
    callbackUrl: samlConfig.callbackUrl,
    library: 'saml2-js',
  });
});

router.get('/test', async (_req, res) => {
  try {
    const instances = createSamlInstances();
    if (!instances) {
      return res.status(500).json({
        error: 'SAML configuration is incomplete',
        details: { enabled: samlConfig.enabled, hasCertificate: !!samlConfig.certificate, certLength: samlConfig.certificate?.length || 0 },
      });
    }

    return res.json({
      status: 'ok',
      library: 'saml2-js',
      config: {
        idpEntityID: instances.idp.entity_id,
        spEntityID: instances.sp.entity_id,
        acsUrl: samlConfig.callbackUrl,
        hasCert: !!samlConfig.certificate,
        certLength: samlConfig.certificate?.length || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'SAML configuration test failed', message: error.message });
  }
});

// ─── Callback 辅助函数 ──────────────────────────────────────

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

export default router;
