/**
 * SAML Configuration
 *
 * SAML 单点登录配置
 * 所有 SAML 参数必须通过环境变量配置（SAML_ENABLED=true 时由 validateSamlConfig() 校验完整性）
 *
 * @module config/saml.config
 */

import { formatCertificate, formatPrivateKey } from './samlFormatters.js';
import { validateSamlConfig as validateSaml } from './samlValidator.js';

export const samlConfig = {
  // IdP 配置
  entity_id: process.env.SAML_ENTITY_ID || '',
  sso_url: process.env.SAML_SSO_URL || '',
  slo_url: process.env.SAML_SLO_URL || '',
  certificate: formatCertificate(process.env.SAML_IDP_CERTIFICATE || process.env.SAML_CERTIFICATE || ''),

  // SP 配置
  issuer: process.env.SAML_ISSUER || process.env.APP_URL || 'http://localhost:5173',
  callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:3001/api/auth/saml/callback',
  logoutCallbackUrl: process.env.SAML_LOGOUT_CALLBACK_URL || 'http://localhost:3001/api/auth/saml/logout/callback',
  spCertificate: formatCertificate(process.env.SAML_SP_CERTIFICATE || ''),
  spPrivateKey: formatPrivateKey(process.env.SAML_SP_PRIVATE_KEY || ''),
  enableRequestSigning: process.env.SAML_ENABLE_REQUEST_SIGNING === 'true',

  // 安全配置
  clockSkewMs: parseInt(process.env.SAML_CLOCK_SKEW_MS || '300000', 10),
  enabled: process.env.SAML_ENABLED === 'true',

  // 协议配置
  binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
  nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
};

/**
 * 验证 SAML 配置是否完整
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSamlConfig() {
  return validateSaml(samlConfig);
}

export default samlConfig;
