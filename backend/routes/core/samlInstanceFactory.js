/**
 * SAML Instance Factory
 *
 * SAML 实例工厂 - 负责 SAML SP/IdP 实例的创建和配置
 *
 * @module routes/core/samlInstanceFactory
 */

import { samlConfig, validateSamlConfig } from '../../config/saml.config.js';
import saml2 from 'saml2-js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('routes/core/samlInstanceFactory');
const { ServiceProvider: Saml, IdentityProvider: IdP } = saml2;

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

export { createSamlInstances };
