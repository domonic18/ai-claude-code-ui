/**
 * PermissionModeSelector Component
 *
 * Button for toggling between different permission modes.
 *
 * Permission Modes (based on Claude SDK):
 * - default: Standard permission behavior, tools may require confirmation
 * - acceptEdits: Auto-accept file edits
 * - bypassPermissions: Bypass all permission checks (use with caution)
 * - plan: Planning mode - no execution, review before running
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

export interface PermissionModeSelectorProps {
  /** Current permission mode */
  mode: PermissionMode;
  /** Callback when mode changes */
  onModeChange: (mode: PermissionMode) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

const MODE_CONFIG = {
  default: {
    label: 'Standard',
    color: 'blue',
    description: 'Standard mode - tools may require confirmation',
  },
  acceptEdits: {
    label: 'Auto Edits',
    color: 'green',
    description: 'Auto-accept file edits suggested by AI',
  },
  bypassPermissions: {
    label: 'Bypass',
    color: 'orange',
    description: 'Bypass all permission checks (use with caution)',
  },
  plan: {
    label: 'Plan Only',
    color: 'purple',
    description: 'Planning mode - review before executing',
  },
} as const;

/**
 * PermissionModeSelector Component
 *
 * Displays a button showing the current permission mode with color indicator.
 */
export function PermissionModeSelector({
  mode,
  onModeChange,
  disabled = false,
}: PermissionModeSelectorProps) {
  const { t } = useTranslation();

  const config = MODE_CONFIG[mode];
  const colorClass = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 hover:bg-green-100 dark:hover:bg-green-900/30',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30',
  }[config.color];

  const dotColorClass = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
  }[config.color];

  /**
   * Cycle to next mode
   */
  const handleModeSwitch = () => {
    if (disabled) return;
    const modes: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    onModeChange(nextMode);
  };

  return (
    <button
      type="button"
      onClick={handleModeSwitch}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${colorClass} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      title={config.description}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColorClass}`} />
        <span>{config.label}</span>
      </div>
    </button>
  );
}

export default PermissionModeSelector;
