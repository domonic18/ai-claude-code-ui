/**
 * ToggleSwitch - Reusable toggle switch component
 *
 * @module shared/components/ui/ToggleSwitch
 */

import React from 'react';
import { Moon, Sun } from 'lucide-react';

interface ToggleSwitchProps {
  /** Whether the toggle is on */
  checked: boolean;
  /** Change handler */
  onChange: () => void;
  /** Accessible label */
  ariaLabel: string;
  /** Optional icon to show in toggle knob (moon/sun for theme toggles) */
  icon?: 'theme';
}

/**
 * Accessible toggle switch with optional theme icon
 */
export function ToggleSwitch({ checked, onChange, ariaLabel, icon }: ToggleSwitchProps) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
        checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
      }`}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
    >
      <span className="sr-only">{ariaLabel}</span>
      <span
        className={`${
          checked ? 'translate-x-7' : 'translate-x-1'
        } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 flex items-center justify-center`}
      >
        {icon === 'theme' && (
          checked
            ? <Moon className="w-3.5 h-3.5 text-gray-700" />
            : <Sun className="w-3.5 h-3.5 text-yellow-500" />
        )}
      </span>
    </button>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

/** Standard setting row layout with label/description and control */
export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-foreground">{label}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
