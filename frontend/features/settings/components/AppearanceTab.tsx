/**
 * AppearanceTab Component
 *
 * Handles appearance-related settings - matches original Settings.jsx exactly.
 *
 * Features:
 * - Dark mode toggle
 * - Project sorting
 * - Code editor theme and settings
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { useTheme } from '@/shared/contexts/ThemeContext';
import { useTourContext } from '@/shared/contexts/TourContext';
import { useCodeEditorSettings } from '../hooks';
import { ToggleSwitch, SettingRow } from '@/shared/components/ui/ToggleSwitch';

const FONT_SIZE_OPTIONS = [
  { value: '10', label: '10px' },
  { value: '11', label: '11px' },
  { value: '12', label: '12px' },
  { value: '13', label: '13px' },
  { value: '14', label: '14px' },
  { value: '15', label: '15px' },
  { value: '16', label: '16px' },
  { value: '18', label: '18px' },
  { value: '20', label: '20px' },
];

/**
 * AppearanceTab Component
 */
export function AppearanceTab() {
  const { t } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { startTour } = useTourContext();
  const {
    settings, setCodeEditorTheme, setCodeEditorWordWrap,
    setCodeEditorShowMinimap, setCodeEditorLineNumbers, setCodeEditorFontSize,
  } = useCodeEditorSettings();

  const [projectSortOrder, setProjectSortOrder] = useState('name');

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Theme Settings */}
      <div className="space-y-4">
        <SettingRow label={t('settings.appearance.darkMode')} description={t('settings.appearance.darkModeDescription')}>
          <ToggleSwitch
            checked={isDarkMode}
            onChange={toggleDarkMode}
            ariaLabel={t('settings.appearance.toggleDarkMode')}
            icon="theme"
          />
        </SettingRow>
      </div>

      {/* Project Sorting */}
      <div className="space-y-4">
        <SettingRow label={t('settings.appearance.projectSorting')} description={t('settings.appearance.projectSortingDescription')}>
          <select
            value={projectSortOrder}
            onChange={(e) => setProjectSortOrder(e.target.value)}
            className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 w-32"
          >
            <option value="name">{t('settings.appearance.alphabetical')}</option>
            <option value="date">{t('settings.appearance.recentActivity')}</option>
          </select>
        </SettingRow>
      </div>

      {/* Code Editor Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t('settings.appearance.codeEditor')}</h3>

        <SettingRow label={t('settings.appearance.editorTheme')} description={t('settings.appearance.editorThemeDescription')}>
          <ToggleSwitch
            checked={settings.theme === 'dark'}
            onChange={() => setCodeEditorTheme(settings.theme === 'dark' ? 'light' : 'dark')}
            ariaLabel={t('settings.appearance.toggleEditorTheme')}
            icon="theme"
          />
        </SettingRow>

        <SettingRow label={t('settings.appearance.wordWrap')} description={t('settings.appearance.wordWrapDescription')}>
          <ToggleSwitch
            checked={settings.wordWrap}
            onChange={() => setCodeEditorWordWrap(!settings.wordWrap)}
            ariaLabel={t('settings.appearance.toggleWordWrap')}
          />
        </SettingRow>

        <SettingRow label={t('settings.appearance.showMinimap')} description={t('settings.appearance.showMinimapDescription')}>
          <ToggleSwitch
            checked={settings.showMinimap}
            onChange={() => setCodeEditorShowMinimap(!settings.showMinimap)}
            ariaLabel={t('settings.appearance.toggleMinimap')}
          />
        </SettingRow>

        <SettingRow label={t('settings.appearance.showLineNumbers')} description={t('settings.appearance.showLineNumbersDescription')}>
          <ToggleSwitch
            checked={settings.lineNumbers}
            onChange={() => setCodeEditorLineNumbers(!settings.lineNumbers)}
            ariaLabel={t('settings.appearance.toggleLineNumbers')}
          />
        </SettingRow>

        <SettingRow label={t('settings.appearance.fontSize')} description={t('settings.appearance.fontSizeDescription')}>
          <select
            value={settings.fontSize}
            onChange={(e) => setCodeEditorFontSize(e.target.value)}
            className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 w-24"
          >
            {FONT_SIZE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SettingRow>
      </div>

      {/* Product Tour */}
      <div className="space-y-4">
        <SettingRow label={t('tour.title')} description={t('tour.showTourAgain')}>
          <button
            onClick={startTour}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {t('tour.showTourAgain')}
          </button>
        </SettingRow>
      </div>
    </div>
  );
}

export default AppearanceTab;
