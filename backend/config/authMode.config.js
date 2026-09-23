/**
 * Auth Mode Configuration
 *
 * 认证模式配置
 * 认证方式：仅 SAML SSO（密码登录已移除）
 * - SSO_ADMIN_USERS: SAML 登录用户的用户名（NameID）白名单，命中者自动提升为 admin（逗号分隔）
 *
 * @module config/authMode.config
 */

/**
 * 解析逗号分隔的白名单为小写数组
 * 空字符串/未配置返回空数组
 * @param {string} raw - 环境变量原始值（逗号分隔用户名）
 * @returns {string[]} 小写用户名数组
 */
function parseAllowlist(raw) {
  return (raw || '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

export const authModeConfig = {
  /** SSO admin 用户名白名单（小写），SAML 登录命中即提升为 admin */
  ssoAdminUsers: parseAllowlist(process.env.SSO_ADMIN_USERS),
};
