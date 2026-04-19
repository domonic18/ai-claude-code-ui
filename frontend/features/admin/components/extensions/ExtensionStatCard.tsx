/**
 * ExtensionStatCard - Reusable statistics card for extension types
 *
 * @module features/admin/components/extensions/ExtensionStatCard
 */

import React from 'react';

interface ExtensionStatCardProps {
  /** Display label */
  label: string;
  /** Item count */
  count: number;
  /** Emoji icon */
  icon: string;
  /** Tailwind color name (blue, green, purple, orange, teal) */
  color: 'blue' | 'green' | 'purple' | 'orange' | 'teal';
}

const COLOR_CLASSES = {
  blue: {
    gradient: 'from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20',
    border: 'border-blue-500/20 dark:border-blue-500/30',
    label: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-500/20 dark:bg-blue-500/30',
  },
  green: {
    gradient: 'from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20',
    border: 'border-green-500/20 dark:border-green-500/30',
    label: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-500/20 dark:bg-green-500/30',
  },
  purple: {
    gradient: 'from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20',
    border: 'border-purple-500/20 dark:border-purple-500/30',
    label: 'text-purple-600 dark:text-purple-400',
    value: 'text-purple-700 dark:text-purple-300',
    badge: 'bg-purple-500/20 dark:bg-purple-500/30',
  },
  orange: {
    gradient: 'from-orange-500/10 to-orange-600/10 dark:from-orange-500/20 dark:to-orange-600/20',
    border: 'border-orange-500/20 dark:border-orange-500/30',
    label: 'text-orange-600 dark:text-orange-400',
    value: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-500/20 dark:bg-orange-500/30',
  },
  teal: {
    gradient: 'from-teal-500/10 to-teal-600/10 dark:from-teal-500/20 dark:to-teal-600/20',
    border: 'border-teal-500/20 dark:border-teal-500/30',
    label: 'text-teal-600 dark:text-teal-400',
    value: 'text-teal-700 dark:text-teal-300',
    badge: 'bg-teal-500/20 dark:bg-teal-500/30',
  },
} as const;

/**
 * Displays a colored stat card with icon, label, and count
 */
export function ExtensionStatCard({ label, count, icon, color }: ExtensionStatCardProps) {
  const cls = COLOR_CLASSES[color];

  return (
    <div className={`bg-gradient-to-br ${cls.gradient} ${cls.border} border rounded-lg p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${cls.label}`}>{label}</p>
          <p className={`text-3xl font-bold ${cls.value} mt-1`}>{count}</p>
        </div>
        <div className={`w-12 h-12 ${cls.badge} rounded-full flex items-center justify-center`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}
