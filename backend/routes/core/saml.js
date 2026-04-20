/**
 * SAML Authentication Routes
 *
 * SAML 单点登录路由 - 使用 saml2-js 实现
 *
 * @module routes/core/saml
 */

import { Router } from 'express';
import { samlConfig } from '../../config/saml.config.js';
import { createLogger } from '../../utils/logger.js';
import { createSamlInstances } from './samlInstanceFactory.js';
import {
  extractUserInfo,
  findOrCreateUser,
  setAuthCookie,
  initiateContainerCreation,
  redirectToFrontend,
} from './samlUserManager.js';

const logger = createLogger('routes/core/saml');
const router = Router();

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

    // 设置认证 cookie 并重定向
    setAuthCookie(res, user);
    initiateContainerCreation(user);
    return redirectToFrontend(res);

  } catch (error) {
    logger.error('[SAML] Error during callback processing:', error);

    // Handle custom errors with status codes
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

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

export default router;
