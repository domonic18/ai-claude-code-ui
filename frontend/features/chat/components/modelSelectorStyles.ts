/**
 * Model Selector Styles
 *
 * Style mapping and color utilities for ModelSelector component.
 * Extracted from ModelSelector.tsx to reduce complexity.
 *
 * @module frontend/features/chat/components/modelSelectorStyles
 */

/**
 * Get color classes for token badge based on usage percentage
 * @param tokenPercentage - Token usage percentage
 * @returns Tailwind CSS class string
 */
export function getTokenBadgeColorClasses(tokenPercentage: number): string {
  if (tokenPercentage >= 90) {
    return 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400';
  }
  if (tokenPercentage >= 70) {
    return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400';
  }
  return 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400';
}

/**
 * Get button style classes based on state
 * @param disabled - Whether button is disabled
 * @returns Tailwind CSS class string
 */
export function getButtonClasses(disabled: boolean): string {
  const baseClasses = 'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors';

  if (disabled) {
    return `${baseClasses} border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed`;
  }

  return `${baseClasses} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer`;
}

/**
 * Get model item style classes based on selection state
 * @param isSelected - Whether model is selected
 * @returns Tailwind CSS class string
 */
export function getModelItemClasses(isSelected: boolean): string {
  const baseClasses = 'w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-l-4';

  if (isSelected) {
    return `${baseClasses} bg-blue-50 dark:bg-blue-900/30 border-blue-500`;
  }

  return `${baseClasses} border-transparent`;
}

/**
 * Get model name text color based on selection state
 * @param isSelected - Whether model is selected
 * @returns Tailwind CSS class string
 */
export function getModelNameClasses(isSelected: boolean): string {
  if (isSelected) {
    return 'text-sm font-medium text-blue-700 dark:text-blue-300';
  }
  return 'text-sm font-medium text-gray-900 dark:text-white';
}
