/**
 * Settings Component (Refactored - Progressive)
 *
 * Main settings modal container using modular architecture.
 * This is a progressive refactor - starting with structure while keeping existing logic.
 *
 * Phase 1: Create modular structure
 * - Split into tab components
 * - Extract reusable layout elements
 * - Keep existing logic in place temporarily
 *
 * Responsibilities:
 * - Render settings modal
 * - Manage tab navigation
 * - Delegate to tab-specific components
 */

import React, { useState } from 'react';
import { X, GitBranch, Key } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { SettingsTab, SettingsProps } from '../types/settings.types';
import { SETTINGS_TABS } from '../constants/settings.constants';

// Import existing components as tabs (will be refactored gradually)
import GitSettings from '../../../components/GitSettings';
import TasksSettings from '../../../components/TasksSettings';
import { AppearanceTab } from './AppearanceTab';
import { AgentTab } from './AgentTab';

// Temporary: Import existing Settings component content for other tabs
// This will be replaced with refactored components
import LegacySettingsContent from './LegacySettingsContent';

/**
 * Settings Modal Component
 */
export function Settings({
  isOpen,
  onClose,
  projects = [],
  initialTab = 'agents',
  autoRefreshInterval,
  setAutoRefreshInterval,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 flex items-center justify-center z-[9999] md:p-4 bg-background/95">
      <div className="bg-background border border-border md:rounded-lg shadow-xl w-full md:max-w-4xl h-full md:h-[90vh] flex flex-col">
        {/* Header */}
        <SettingsHeader onClose={onClose} />

        {/* Tab Navigation */}
        <SettingsNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 pb-safe-area-inset-bottom">
          {activeTab === 'git' && (
            <GitSettings
              projects={projects}
              isOpen={isOpen}
              onClose={onClose}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksSettings
              isOpen={isOpen}
              onClose={onClose}
            />
          )}

          {/* Newly refactored: Appearance tab */}
          {activeTab === 'appearance' && <AppearanceTab />}

          {/* Newly refactored: Agents tab */}
          {activeTab === 'agents' && <AgentTab />}

          {/* Temporary: Use legacy content for api tab (not yet migrated) */}
          {activeTab === 'api' && (
            <LegacySettingsContent
              activeTab={activeTab}
              projects={projects}
              autoRefreshInterval={autoRefreshInterval}
              setAutoRefreshInterval={setAutoRefreshInterval}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Settings Header Component
 */
interface SettingsHeaderProps {
  onClose: () => void;
}

function SettingsHeader({ onClose }: SettingsHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 md:p-6 border-b border-border flex-shrink-0">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h2 className="text-lg md:text-xl font-semibold text-foreground">
          Settings
        </h2>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground touch-manipulation"
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  );
}

/**
 * Settings Navigation Component
 */
interface SettingsNavigationProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

function SettingsNavigation({ activeTab, onTabChange }: SettingsNavigationProps) {
  return (
    <div className="border-b border-border">
      <div className="flex px-4 md:px-6 overflow-x-auto">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.id === 'git' && <GitBranch className="w-4 h-4 inline mr-2" />}
            {tab.id === 'api' && <Key className="w-4 h-4 inline mr-2" />}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Settings;
