/**
 * Settings Page Types
 *
 * Type definitions for settings page components.
 */

import type { SettingsTab } from '@/features/settings/types/settings.types';

/**
 * SettingsPage props
 */
export interface SettingsPageProps {
  initialTab?: SettingsTab;
}
