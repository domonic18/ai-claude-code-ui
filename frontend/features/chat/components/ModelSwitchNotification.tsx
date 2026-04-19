/**
 * ModelSwitchNotification Component
 *
 * Displays a notification banner when the model is automatically switched.
 */

import React from 'react';

interface ModelSwitchNotificationProps {
  /** Whether to show the notification */
  show: boolean;
  /** Notification message */
  message: string;
}

export function ModelSwitchNotification({ show, message }: ModelSwitchNotificationProps) {
  if (!show) return null;

  return (
    <div className="px-4 pb-2">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg flex items-center gap-2">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}
