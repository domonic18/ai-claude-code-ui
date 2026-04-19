/**
 * McpServerFormModeToggle Component
 *
 * Toggle buttons for switching between form input and JSON import modes.
 */

import React from 'react';

export interface McpServerFormModeToggleProps {
  importMode: 'form' | 'json';
  onModeChange: (mode: 'form' | 'json') => void;
}

/**
 * McpServerFormModeToggle - Form/JSON import mode toggle buttons
 */
export const McpServerFormModeToggle: React.FC<McpServerFormModeToggleProps> = ({
  importMode,
  onModeChange
}) => {
  return (
    <div className="flex gap-2 mb-4">
      <button
        type="button"
        onClick={() => onModeChange('form')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          importMode === 'form'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        Form Input
      </button>
      <button
        type="button"
        onClick={() => onModeChange('json')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          importMode === 'json'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        JSON Import
      </button>
    </div>
  );
};

export default McpServerFormModeToggle;
