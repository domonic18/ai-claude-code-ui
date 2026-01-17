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

interface ApiTabProps {
  // Props passed from parent Settings if needed
  // Currently self-contained
}

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
