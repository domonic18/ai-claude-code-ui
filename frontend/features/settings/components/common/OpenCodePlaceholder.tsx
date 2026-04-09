/**
 * OpenCodePlaceholder Component
 *
 * Placeholder UI for OpenCode agent settings (not yet implemented).
 * Displays a "Coming Soon" message.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * OpenCodePlaceholder - Coming soon placeholder for OpenCode settings
 */
export const OpenCodePlaceholder: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('agent.opencode')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          {t('agent.opencodeDescription')}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            {t('agent.comingSoon')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OpenCodePlaceholder;
