/**
 * SAML Configuration
 *
 * SAML 单点登录配置
 * 基于公司统一身份认证系统 (guanghua.53jy.net)
 *
 * @module config/saml.config
 */

/**
 * 格式化证书（添加换行）
 * @param {string} cert - 证书内容
 * @returns {string} 格式化后的证书（不含 BEGIN/END 标签，纯证书内容）
 */
function formatCertificate(cert) {
  if (!cert) return '';

  // 移除周围可能存在的引号（.env 文件中的引号）
  cert = cert.trim();
  if ((cert.startsWith('"') && cert.endsWith('"')) ||
      (cert.startsWith("'") && cert.endsWith("'"))) {
    cert = cert.slice(1, -1);
  }

  // 移除所有空白字符和 BEGIN/END 标签，只保留证书内容
  // 这与同事的 Python 配置一致 - 只使用纯证书字符串
  const certContent = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  if (!certContent) return '';

  // 每 64 字符换行
  const lines = [];
  for (let i = 0; i < certContent.length; i += 64) {
    lines.push(certContent.substr(i, 64));
  }

  // 返回带标签的完整证书（passport-saml 需要带标签）
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

/**
 * 格式化私钥（添加换行）
 * @param {string} key - 私钥内容
 * @returns {string} 格式化后的私钥
 */
function formatPrivateKey(key) {
  if (!key) return '';

  // 移除周围可能存在的引号（.env 文件中的引号）
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  // 移除 BEGIN/END 标签和空白字符
  key = key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  if (!key) return '';

  // 每 64 字符换行
  const lines = [];
  for (let i = 0; i < key.length; i += 64) {
    lines.push(key.substr(i, 64));
  }

  // 判断是哪种类型的私钥
  const isRSA = key.includes('RSA');  // 简单判断

  if (isRSA) {
    return `-----BEGIN RSA PRIVATE KEY-----\n${lines.join('\n')}\n-----END RSA PRIVATE KEY-----`;
  } else {
    return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
  }
}

export const samlConfig = {
  // ═════════════════════════════════════════════════════════════
  // IdP (Identity Provider) 配置 - 从 Metadata 提取
  // ═════════════════════════════════════════════════════════════

  // IdP Entity ID (Issuer)
  entity_id: process.env.SAML_ENTITY_ID || 'https://guanghua.53jy.net/idp/metadata',

  // SSO URL - 用户登录时的跳转地址
  sso_url: process.env.SAML_SSO_URL || 'https://guanghua.53jy.net/idp/login',

  // SLO URL - 用户登出时的地址（可选）
  slo_url: process.env.SAML_SLO_URL || 'https://guanghua.53jy.net/idp/logout',

  // IdP X.509 Certificate - 用于验证 SAML Response 签名
  // 自动格式化证书（添加换行）
  certificate: formatCertificate(process.env.SAML_IDP_CERTIFICATE || process.env.SAML_CERTIFICATE || ''),

  // ═════════════════════════════════════════════════════════════
  // SP (Service Provider) 配置 - 你的系统配置
  // ═════════════════════════════════════════════════════════════

  // SP Entity ID - 你的系统标识符
  issuer: process.env.SAML_ISSUER || process.env.APP_URL || 'http://localhost:5173',

  // ACS URL - Assertion Consumer Service URL (回调地址)
  // 注意：IdP 会回调这个地址，所以必须是后端服务器的地址
  callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:3001/api/auth/saml/callback',

  // SLO Callback URL - 登出回调地址（可选）
  logoutCallbackUrl: process.env.SAML_LOGOUT_CALLBACK_URL || 'http://localhost:3001/api/auth/saml/logout/callback',

  // SP X.509 Certificate - 用于签署 SAML Request（某些IdP要求）
  spCertificate: formatCertificate(process.env.SAML_SP_CERTIFICATE || ''),

  // SP Private Key - 用于签署 SAML Request（某些IdP要求）
  spPrivateKey: formatPrivateKey(process.env.SAML_SP_PRIVATE_KEY || ''),

  // 是否启用 SP 请求签名（某些 IdP 要求，某些不需要）
  enableRequestSigning: process.env.SAML_ENABLE_REQUEST_SIGNING === 'true',

  // ═════════════════════════════════════════════════════════════
  // 安全配置
  // ═════════════════════════════════════════════════════════════

  // 时钟偏移容忍度（毫秒）
  clockSkewMs: parseInt(process.env.SAML_CLOCK_SKEW_MS || '300000', 10), // 5 分钟

  // 是否启用 SAML
  enabled: process.env.SAML_ENABLED === 'true',

  // ═════════════════════════════════════════════════════════════
  // 其他配置
  // ═════════════════════════════════════════════════════════════

  // SAML 协议绑定
  binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',

  // NameID 格式
  nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
};

/**
 * 验证 SAML 配置是否完整
 * @returns {Object} 验证结果 { valid: boolean, errors: string[] }
 */
export function validateSamlConfig() {
  const errors = [];

  if (!samlConfig.enabled) {
    return { valid: true, errors: [] }; // 未启用时不验证
  }

  if (!samlConfig.entity_id) {
    errors.push('SAML_ENTITY_ID is required');
  }

  if (!samlConfig.sso_url) {
    errors.push('SAML_SSO_URL is required');
  }

  if (!samlConfig.certificate || samlConfig.certificate.length < 100) {
    errors.push('SAML_IDP_CERTIFICATE is incomplete or missing');
  }

  if (!samlConfig.issuer) {
    errors.push('SAML_ISSUER (SP Entity ID) is required');
  }

  if (!samlConfig.callbackUrl) {
    errors.push('SAML_CALLBACK_URL is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default samlConfig;
