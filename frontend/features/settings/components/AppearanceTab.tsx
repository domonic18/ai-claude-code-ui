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

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/contexts/ThemeContext';
import { useCodeEditorSettings } from '../hooks';

/**
 * AppearanceTab Component
 */
export function AppearanceTab() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { settings, setCodeEditorTheme, setCodeEditorWordWrap, setCodeEditorShowMinimap, setCodeEditorLineNumbers, setCodeEditorFontSize } = useCodeEditorSettings();

  // Local state for project sorting
  const [projectSortOrder, setProjectSortOrder] = React.useState('name');

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Theme Settings */}
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Dark Mode
              </div>
              <div className="text-sm text-muted-foreground">
                Toggle between light and dark themes
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                isDarkMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={isDarkMode}
              aria-label="Toggle dark mode"
            >
              <span className="sr-only">Toggle dark mode</span>
              <span
                className={`${
                  isDarkMode ? 'translate-x-7' : 'translate-x-1'
                } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 flex items-center justify-center`}
              >
                {isDarkMode ? (
                  <Moon className="w-3.5 h-3.5 text-gray-700" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-yellow-500" />
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Project Sorting */}
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Project Sorting
              </div>
              <div className="text-sm text-muted-foreground">
                How projects are ordered in the sidebar
              </div>
            </div>
            <select
              value={projectSortOrder}
              onChange={(e) => setProjectSortOrder(e.target.value)}
              className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 w-32"
            >
              <option value="name">Alphabetical</option>
              <option value="date">Recent Activity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Code Editor Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Code Editor</h3>

        {/* Editor Theme */}
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Editor Theme
              </div>
              <div className="text-sm text-muted-foreground">
                Default theme for the code editor
              </div>
            </div>
            <button
              onClick={() => setCodeEditorTheme(settings.theme === 'dark' ? 'light' : 'dark')}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                settings.theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={settings.theme === 'dark'}
              aria-label="Toggle editor theme"
            >
              <span className="sr-only">Toggle editor theme</span>
              <span
                className={`${
                  settings.theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 flex items-center justify-center`}
              >
                {settings.theme === 'dark' ? (
                  <Moon className="w-3.5 h-3.5 text-gray-700" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-yellow-500" />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Word Wrap */}
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Word Wrap
              </div>
              <div className="text-sm text-muted-foreground">
                Enable word wrapping by default in the editor
              </div>
            </div>
            <button
              onClick={() => setCodeEditorWordWrap(!settings.wordWrap)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                settings.wordWrap ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={settings.wordWrap}
              aria-label="Toggle word wrap"
            >
              <span className="sr-only">Toggle word wrap</span>
              <span
                className={`${
                  settings.wordWrap ? 'translate-x-7' : 'translate-x-1'
                } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200`}
              />
            </button>
          </div>
        </div>

        {/* Show Minimap */}
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Show Minimap
              </div>
              <div className="text-sm text-muted-foreground">
                Display a minimap for easier navigation in diff view
              </div>
            </div>
            <button
              onClick={() => setCodeEditorShowMinimap(!settings.showMinimap)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                settings.showMinimap ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={settings.showMinimap}
              aria-label="Toggle minimap"
            >
              <span className="sr-only">Toggle minimap</span>
              <span
                className={`${
                  settings.showMinimap ? 'translate-x-7' : 'translate-x-1'
                } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200`}
              />
            </button>
          </div>
        </div>

        {/* Show Line Numbers */}
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Show Line Numbers
              </div>
              <div className="text-sm text-muted-foreground">
                Display line numbers in the editor
              </div>
            </div>
            <button
              onClick={() => setCodeEditorLineNumbers(!settings.lineNumbers)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                settings.lineNumbers ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={settings.lineNumbers}
              aria-label="Toggle line numbers"
            >
              <span className="sr-only">Toggle line numbers</span>
              <span
                className={`${
                  settings.lineNumbers ? 'translate-x-7' : 'translate-x-1'
                } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200`}
              />
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                Font Size
              </div>
              <div className="text-sm text-muted-foreground">
                Editor font size in pixels
              </div>
            </div>
            <select
              value={settings.fontSize}
              onChange={(e) => setCodeEditorFontSize(e.target.value)}
              className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 w-24"
            >
              <option value="10">10px</option>
              <option value="11">11px</option>
              <option value="12">12px</option>
              <option value="13">13px</option>
              <option value="14">14px</option>
              <option value="15">15px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppearanceTab;
