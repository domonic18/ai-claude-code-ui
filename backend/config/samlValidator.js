/**
 * samlValidator.js
 *
 * SAML 配置验证逻辑
 * Extracted from saml.config to reduce complexity
 *
 * @module config/samlValidator
 */

// 验证 URL 是否使用 HTTPS 协议，用于 SAML 安全配置检查
/**
 * 验证 URL 是否使用 https 协议
 * @param {string} url - 要验证的 URL
 * @param {string} fieldName - 字段名（用于错误消息）
 * @param {string[]} errors - 累积错误列表
 */
function validateHttpsUrl(url, fieldName, errors) {
  try {
    // eslint-disable-next-line no-undef
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      errors.push(`${fieldName} must use https protocol`);
    }
  } catch {
    errors.push(`${fieldName} is not a valid URL`);
  }
}

// 验证 SAML 配置的完整性和安全性，在启用 SAML 时调用
/**
 * 验证 SAML 配置是否完整
 * @param {Object} config - samlConfig 对象
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSamlConfig(config) {
  const errors = [];

  if (!config.enabled) return { valid: true, errors: [] };

  if (!config.entity_id) errors.push('SAML_ENTITY_ID is required');

  if (!config.sso_url) {
    errors.push('SAML_SSO_URL is required');
  } else {
    validateHttpsUrl(config.sso_url, 'SAML_SSO_URL', errors);
  }

  if (config.slo_url) {
    validateHttpsUrl(config.slo_url, 'SAML_SLO_URL', errors);
  }

  if (!config.certificate || config.certificate.length < 100) {
    errors.push('SAML_IDP_CERTIFICATE is incomplete or missing');
  }

  if (!config.issuer) errors.push('SAML_ISSUER (SP Entity ID) is required');
  if (!config.callbackUrl) errors.push('SAML_CALLBACK_URL is required');

  return { valid: errors.length === 0, errors };
}
