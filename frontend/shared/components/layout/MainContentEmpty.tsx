/*
 * MainContentEmpty.tsx - No-project-selected state view
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface MainContentEmptyProps {
  isMobile: boolean;
  onMenuClick: () => void;
}

export function MainContentEmpty({ isMobile, onMenuClick }: MainContentEmptyProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col">
      {isMobile && (
        <div className="bg-background border-b border-border p-2 sm:p-3 pwa-header-safe flex-shrink-0">
          <button
            onClick={onMenuClick}
            className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent pwa-menu-button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground max-w-md mx-auto px-6">
          <div className="w-16 h-16 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-3 text-foreground">{t('mainContent.chooseYourProject')}</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            {t('mainContent.projectDescription')}
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>{t('mainContent.tip')}:</strong> {isMobile ? t('mainContent.tapMenuToAccessProjects') : t('mainContent.createNewProjectTip')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
