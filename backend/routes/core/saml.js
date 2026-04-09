/**
 * SAML Authentication Routes
 *
 * SAML 单点登录路由 - 使用 saml2-js 实现
 *
 * @module routes/core/saml
 */

import { Router } from 'express';
import { samlConfig } from '../../config/saml.config.js';
import { generateToken } from '../../middleware/auth.middleware.js';
import containerManager from '../../services/container/core/index.js';
import { repositories } from '../../database/db.js';
import saml2 from 'saml2-js';

const { User } = repositories;
const { ServiceProvider: Saml, IdentityProvider: IdP } = saml2;

const router = Router();

// 创建 SAML 实例
function createSamlInstances() {
  if (!samlConfig.enabled) {
    return null;
  }

  try {
    // 解析 IdP 证书（移除空白和换行）
    const idpCert = samlConfig.certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    // 解析 SP 私钥（如果配置了）
    const spPrivateKey = samlConfig.spPrivateKey
      ?.replace(/-----BEGIN PRIVATE KEY-----/g, '')
      ?.replace(/-----END PRIVATE KEY-----/g, '')
      ?.replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
      ?.replace(/-----END RSA PRIVATE KEY-----/g, '')
      ?.replace(/\s/g, '');

    // 解析 SP 证书（如果配置了）
    const spCert = samlConfig.spCertificate
      ?.replace(/-----BEGIN CERTIFICATE-----/g, '')
      ?.replace(/-----END CERTIFICATE-----/g, '')
      ?.replace(/\s/g, '');

    // 创建 IdP 实例（使用下划线命名）
    const idp = new IdP({
      sso_login_url: samlConfig.sso_url,
      sso_logout_url: samlConfig.slo_url,
      certificates: [idpCert],
      entity_id: samlConfig.entity_id,
    });

    // 创建 SP 实例（使用下划线命名）
    const spConfig = {
      entity_id: samlConfig.issuer,
      assert_endpoint: samlConfig.callbackUrl,
      // 重要：允许未加密的 Assertion（只签名，不加密）
      allow_unencrypted_assertion: true,
    };

    // 如果配置了 SP 证书和私钥，添加到配置中
    if (spPrivateKey && spCert) {
      spConfig.private_key = spPrivateKey;
      spConfig.certificate = spCert;
    }

    const sp = new Saml(spConfig);

    return { sp, idp };
  } catch (error) {
    console.error('[SAML] Failed to create SAML instances:', error);
    return null;
  }
}

/**
 * POST /init
 * 初始化 SSO 登录
 */
router.post('/init', (req, res) => {
  if (!samlConfig.enabled) {
    return res.status(404).json({
      error: 'SAML authentication is not enabled',
      code: 'SAML_DISABLED'
    });
  }

  const { return_to } = req.body;

  if (!return_to) {
    return res.status(400).json({
      error: 'return_to parameter is required',
      code: 'MISSING_RETURN_TO'
    });
  }

  // 优先使用环境变量配置的 SAML_ISSUER 来构建 sso-login URL
  // SAML_ISSUER 格式: http://brain.bj33smarter.com:20080/api/auth/saml
  // 我们需要将其转换为: http://brain.bj33smarter.com:20080/api/auth/saml/sso-login
  let baseUrl = samlConfig.issuer;

  // 如果 SAML_ISSUER 未配置或为空，回退到请求的协议和主机
  if (!baseUrl || baseUrl === 'http://localhost:5173') {
    const protocol = req.protocol;
    const host = req.get('host');
    baseUrl = `${protocol}://${host}/api/auth/saml`;
  }

  const ssoLoginUrl = `${baseUrl}/sso-login`;

  return res.json({
    login_url: ssoLoginUrl,
    return_to: return_to
  });
});

/**
 * GET /sso-login
 * 发起 SAML 登录请求
 */
router.get('/sso-login', async (req, res) => {
  if (!samlConfig.enabled) {
    return res.status(404).json({
      error: 'SAML authentication is not enabled',
      code: 'SAML_DISABLED'
    });
  }

  try {
    const instances = createSamlInstances();
    if (!instances) {
      throw new Error('Failed to create SAML instances');
    }

    // 使用 Promise 包装 saml2-js 的回调式 API
    const { sp, idp } = instances;
    const url = await new Promise((resolve, reject) => {
      sp.create_login_request_url(idp, {}, (err, url) => {
        if (err) reject(err);
        else resolve(url);
      });
    });

    return res.redirect(url);
  } catch (error) {
    console.error('[SAML] Error creating login request:', error);
    return res.status(500).json({
      error: 'Failed to create SAML login request',
      message: error.message
    });
  }
});

/**
 * POST /callback
 * 处理 SAML Response
 */
router.post('/callback', async (req, res) => {
  if (!samlConfig.enabled) {
    return res.status(404).json({
      error: 'SAML authentication is not enabled',
      code: 'SAML_DISABLED'
    });
  }

  if (!req.body.SAMLResponse) {
    return res.status(400).json({
      error: 'SAMLResponse is required',
      code: 'MISSING_SAML_RESPONSE'
    });
  }

  try {
    const instances = createSamlInstances();
    if (!instances) {
      throw new Error('Failed to create SAML instances');
    }

    // 使用 Promise 包装 saml2-js 的 post_assert 回调式 API
    const { sp, idp } = instances;
    const spResponse = await new Promise((resolve, reject) => {
      sp.post_assert(idp, { request_body: req.body }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });

    // 提取用户信息
    // saml2-js 将数据放在 spResponse.user 下
    const samlUser = spResponse.user || {};
    const externalId = samlUser.name_id;
    const attributes = samlUser.attributes || {};

    // 如果没有 NameID，返回错误
    if (!externalId) {
      return res.status(400).json({
        error: 'SAML Response missing NameID',
        code: 'MISSING_NAMEID',
        details: process.env.NODE_ENV === 'development' ? {
          response: spResponse
        } : undefined
      });
    }

    // attributes 是数组格式，取第一个元素
    const email = (attributes.email && attributes.email[0]) ||
                  (attributes.mail && attributes.mail[0]) ||
                  (attributes.username && attributes.username[0]) ||
                  externalId;
    const firstName = (attributes.firstName && attributes.firstName[0]) ||
                     (attributes.givenname && attributes.givenname[0]) ||
                     (attributes.first_name && attributes.first_name[0]) ||
                     '';
    const lastName = (attributes.lastName && attributes.lastName[0]) ||
                    (attributes.sn && attributes.sn[0]) ||
                    (attributes.last_name && attributes.last_name[0]) ||
                    '';
    const displayName = (attributes.displayName && attributes.displayName[0]) ||
                       (attributes.display_name && attributes.display_name[0]) ||
                       (attributes.name && attributes.name[0]) ||
                       (attributes.username && attributes.username[0]) ||
                       `${firstName} ${lastName}`.trim() ||
                       email;

    // 查找或创建用户
    let user = User.getByExternalId(externalId);

    if (user) {
      // 检查用户是否已有不同的 identity_provider
      if (user.identity_provider && user.identity_provider !== 'saml') {
        return res.status(400).json({
          error: 'User already exists with a different authentication method',
          code: 'IDENTITY_PROVIDER_CONFLICT',
          details: {
            existing_provider: user.identity_provider,
            requested_provider: 'saml'
          }
        });
      }
      User.updateLastLogin(user.id);
    } else {
      // 创建新用户 - 处理可能的数据库错误
      try {
        user = User.createWithSSO({
          username: email,
          email: email,
          identity_provider: 'saml',
          external_id: externalId,
          first_name: firstName,
          last_name: lastName,
          display_name: displayName,
        });
      } catch (dbError) {
        console.error('[SAML] Failed to create user:', dbError);
        return res.status(500).json({
          error: 'Failed to create user',
          code: 'USER_CREATION_FAILED',
          message: dbError.message
        });
      }
    }

    // 生成 JWT token（generateToken 期望 user.id 字段）
    const token = generateToken({ id: user.id, username: user.username });

    // 设置 httpOnly cookie
    // 注意：SAML 跨域重定向需要使用 'lax' 而不是 'strict'
    // 注意：secure 只在 HTTPS 时设为 true，HTTP 部署需要 false
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/'
    };

    if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    res.cookie('auth_token', token, cookieOptions);

    // 为用户创建容器（异步执行，不阻塞登录流程）
    // 容器创建失败不会阻止登录，但会记录错误以便后续调试
    containerManager.getOrCreateContainer(user.id)
      .then(() => {
        console.log(`[SAML] Container ready for user ${user.id}`);
      })
      .catch(err => {
        // 容器创建失败不应阻止登录，但需要记录以便排查
        console.error(`[SAML] Failed to create container for user ${user.id}:`, err.message);
        // 可以考虑发送通知或设置标记让用户知道容器状态
      });

    // 重定向到前端
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173/chat';
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('saml', 'success');
    return res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('[SAML] Error during callback processing:', error);
    return res.status(500).json({
      error: 'SAML callback processing failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /sso-callback (legacy alias)
 */
router.post('/sso-callback', async (req, res, next) => {
  req.url = '/callback';
  return router.handle(req, res, next);
});

/**
 * GET /logout
 * 发起 SAML 登出
 */
router.get('/logout', (req, res) => {
  if (!samlConfig.enabled) {
    return res.status(404).json({
      error: 'SAML authentication is not enabled',
      code: 'SAML_DISABLED'
    });
  }

  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/'
  });

  if (samlConfig.slo_url) {
    return res.redirect(samlConfig.slo_url);
  }

  return res.redirect('/login?logged_out=true');
});

/**
 * GET /metadata
 * SP Metadata 端点
 */
router.get('/metadata', (req, res) => {
  if (!samlConfig.enabled) {
    return res.status(404).json({
      error: 'SAML authentication is not enabled',
      code: 'SAML_DISABLED'
    });
  }

  const instances = createSamlInstances();
  if (!instances) {
    return res.status(500).json({
      error: 'SAML instances not initialized',
    });
  }

  const metadata = instances.sp.create_metadata();
  res.set('Content-Type', 'application/xml');
  res.send(metadata);
});

/**
 * GET /status
 * 获取 SAML 配置状态
 */
router.get('/status', (req, res) => {
  res.json({
    enabled: samlConfig.enabled,
    configured: !!samlConfig.certificate && samlConfig.certificate.length > 100,
    issuer: samlConfig.issuer,
    entryPoint: samlConfig.sso_url,
    callbackUrl: samlConfig.callbackUrl,
    library: 'saml2-js',
  });
});

/**
 * GET /test
 * 测试 SAML 配置
 */
router.get('/test', async (req, res) => {
  try {
    const instances = createSamlInstances();

    if (!instances) {
      return res.status(500).json({
        error: 'SAML configuration is incomplete',
        details: {
          enabled: samlConfig.enabled,
          hasCertificate: !!samlConfig.certificate,
          certLength: samlConfig.certificate?.length || 0,
        }
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
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: 'SAML configuration test failed',
      message: error.message
    });
  }
});

export default router;
