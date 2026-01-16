/**
 * LegacySettingsContent Component
 *
 * Temporary bridge component that renders content from legacy Settings.jsx.
 * This will be replaced gradually with refactored tab components.
 *
 * Phase: Temporary - to be removed after all tabs are migrated
 */

import React from 'react';
import type { SettingsTab } from '../../types/settings.types';
import type { Project } from '../../types/settings.types';

interface LegacySettingsContentProps {
  activeTab: SettingsTab;
  projects?: Project[];
  autoRefreshInterval?: number;
  setAutoRefreshInterval?: (interval: number) => void;
}

/**
 * LegacySettingsContent Component
 *
 * This component extracts and renders the relevant sections from the old Settings.jsx
 * based on the active tab. It's a temporary solution during gradual migration.
 */
export function LegacySettingsContent({
  activeTab,
  projects,
  autoRefreshInterval,
  setAutoRefreshInterval,
}: LegacySettingsContentProps) {
  // Import the legacy Settings component dynamically to avoid circular dependencies
  // For now, we'll render a placeholder that indicates this tab needs migration

  return (
    <div className="space-y-6">
      {/* Temporary: This will be replaced with actual tab content */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
              Migration in Progress
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              The <strong>{activeTab}</strong> tab is currently being migrated to the new architecture.
              Please use the legacy settings page for now.
            </p>
            <div className="mt-3">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Open legacy settings modal
                  window.dispatchEvent(new CustomEvent('open-legacy-settings', { detail: { tab: activeTab } }));
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Legacy Settings →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* For now, we'll import and render the actual legacy content */}
      <LegacyTabContent
        tab={activeTab}
        projects={projects}
        autoRefreshInterval={autoRefreshInterval}
        setAutoRefreshInterval={setAutoRefreshInterval}
      />
    </div>
  );
}

/**
 * LegacyTabContent Component
 *
 * Renders the actual legacy content from Settings.jsx
 * This is a simplified version that will be expanded
 */
function LegacyTabContent({
  tab,
  projects,
  autoRefreshInterval,
  setAutoRefreshInterval,
}: LegacySettingsContentProps) {
  // For the initial migration, we'll show a simplified version
  // In practice, this would import and use the actual legacy Settings component

  if (tab === 'appearance') {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Appearance settings will be migrated here. For now, please check back later.
        </p>
      </div>
    );
  }

  if (tab === 'agents') {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Agent Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Agent settings (Claude, Cursor, Codex) will be migrated here. For now, please check back later.
        </p>
      </div>
    );
  }

  if (tab === 'api') {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">API & Tokens</h3>
        <p className="text-sm text-muted-foreground">
          API key configuration will be migrated here. For now, please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      Content for {tab} tab coming soon.
    </div>
  );
}

export default LegacySettingsContent;
