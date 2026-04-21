/**
 * Settings Page Component
 *
 * Full-page settings view (non-modal version).
 * Reuses the existing tab components from features/settings.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';
import type { SettingsTab } from '@/features/settings/types/settings.types';
import { SETTINGS_TABS } from '@/features/settings/constants/settings.constants';
import { AppearanceTab } from '@/features/settings/components/AppearanceTab';
import { AgentTab } from '@/features/settings/components/AgentTab';
import { ApiTab } from '@/features/settings/components/ApiTab';
import type { SettingsPageProps } from './types/settings.types';

/**
 * Settings Page Component
 */
export function SettingsPage({ initialTab = 'agents' }: SettingsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const agentTabRef = useRef<any>(null);

  // Handle save button click
  const handleSave = useCallback(() => {
    // Trigger save in AgentTab if it's the active tab
    if (activeTab === 'agents' && agentTabRef.current?.savePermissions) {
      agentTabRef.current.savePermissions();
    }
    // Show success message or redirect
    window.history.back();
  }, [activeTab]);

  // Handle cancel button click
  const handleCancel = useCallback(() => {
    // Navigate back to previous page
    navigate(-1);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <Link
              to="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">{t('settings.backToChat')}</span>
            </Link>

            {/* Title */}
            <h1 className="text-xl font-semibold">{t('settings.title')}</h1>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <LanguageSwitcher variant="button" />
              <Button variant="outline" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                {t('settings.saveChanges')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
              >
                {t(`settings.tabs.${tab.id}`)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Appearance tab */}
          {activeTab === 'appearance' && <AppearanceTab />}

          {/* Agents tab */}
          {activeTab === 'agents' && <AgentTab ref={agentTabRef} />}

          {/* API & Tokens tab */}
          {activeTab === 'api' && <ApiTab />}
        </div>
      </main>
    </div>
  );
}
