/**
 * samlFormatters.js
 *
 * SAML 证书/私钥格式化工具
 * Extracted from saml.config to reduce complexity
 *
 * @module config/samlFormatters
 */

// 移除字符串两端的引号，用于处理 .env 文件中的带引号值
/**
 * 移除字符串周围的引号（.env 文件中常见）
 * @param {string} str
 * @returns {string}
 */
function stripQuotes(str) {
  str = str.trim();
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

// 将 base64 内容按 64 字符换行并包装为 PEM 格式
/**
 * 将 PEM 内容按 64 字符换行
 * @param {string} content - 纯 base64 内容
 * @param {string} beginLabel - BEGIN 标签
 * @param {string} endLabel - END 标签
 * @returns {string} 完整 PEM 格式
 */
function wrapPem(content, beginLabel, endLabel) {
  if (!content) return '';
  const lines = [];
  for (let i = 0; i < content.length; i += 64) {
    lines.push(content.substr(i, 64));
  }
  return `-----${beginLabel}-----\n${lines.join('\n')}\n-----${endLabel}-----`;
}

// 格式化 X.509 证书为标准 PEM 格式，用于 SAML 配置
/**
 * 格式化 X.509 证书
 * @param {string} cert - 证书内容
 * @returns {string} 格式化后的证书
 */
export function formatCertificate(cert) {
  if (!cert) return '';
  cert = stripQuotes(cert);

  const certContent = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  return wrapPem(certContent, 'BEGIN CERTIFICATE', 'END CERTIFICATE');
}

// 格式化私钥为标准 PEM 格式，用于 SAML 签名
/**
 * 格式化私钥
 * @param {string} key - 私钥内容
 * @returns {string} 格式化后的私钥
 */
export function formatPrivateKey(key) {
  if (!key) return '';
  key = stripQuotes(key);

  // 检测原始类型
  const isRSA = key.includes('RSA PRIVATE KEY');
  const beginLabel = isRSA ? 'BEGIN RSA PRIVATE KEY' : 'BEGIN PRIVATE KEY';
  const endLabel = isRSA ? 'END RSA PRIVATE KEY' : 'END PRIVATE KEY';

  // 移除所有可能的 PEM 标签和空白
  const keyContent = key
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  return wrapPem(keyContent, beginLabel, endLabel);
}
