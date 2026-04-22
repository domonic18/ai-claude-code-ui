/**
 * ApiTab Component
 *
 * Handles API Keys settings.
 *
 * Features:
 * - API Keys management (create, delete, toggle active)
 * - Version information display
 *
 * This component wraps the existing CredentialsSettings component.
 */

import CredentialsSettings from './CredentialsSettings';

// Settings 页面的 API Keys 标签页组件，用于管理 API 密钥和凭据
interface ApiTabProps {
  // Props passed from parent Settings if needed
  // Currently self-contained
}

// 由父组件调用，React 组件或常量：ApiTab
/**
 * ApiTab Component - Manages API keys and credentials
 */
export function ApiTab({}: ApiTabProps) {
  return (
    <div className="space-y-6 md:space-y-8">
      <CredentialsSettings />
    </div>
  );
}

export default ApiTab;
