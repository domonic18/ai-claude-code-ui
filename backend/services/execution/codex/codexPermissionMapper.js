/**
 * codexPermissionMapper.js
 *
 * Permission mode to Codex options mapper
 *
 * @module services/execution/codex/codexPermissionMapper
 */

/**
 * 将权限模式映射为 Codex SDK 选项
 * @param {string} permissionMode - 'default'、'acceptEdits' 或 'bypassPermissions'
 * @returns {object} - { sandboxMode, approvalPolicy }
 */
export function mapPermissionModeToCodexOptions(permissionMode) {
  switch (permissionMode) {
    case 'acceptEdits':
      return {
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never'
      };
    case 'bypassPermissions':
      return {
        sandboxMode: 'danger-full-access',
        approvalPolicy: 'never'
      };
    case 'default':
    default:
      return {
        sandboxMode: 'workspace-write',
        approvalPolicy: 'untrusted'
      };
  }
}
