/**
 * CollapsiblePanel Component
 *
 * A reusable collapsible panel component with consistent styling.
 */

import React, { ReactNode } from 'react';

export interface CollapsiblePanelProps {
  /** Panel title/summary */
  title: ReactNode;
  /** Panel content */
  children: ReactNode;
  /** Whether the panel is open by default */
  defaultOpen?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Panel ID */
  id?: string;
}

/**
 * CollapsiblePanel Component
 *
 * Provides a consistent collapsible panel with arrow icon animation.
 */
export function CollapsiblePanel({
  title,
  children,
  defaultOpen = false,
  className = '',
  id,
}: CollapsiblePanelProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={`relative group/details ${className}`}
    >
      <summary className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50">
        <svg className="w-4 h-4 transition-transform duration-200 group-open/details:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {title}
      </summary>
      <div className="mt-3 pl-6">
        {children}
      </div>
    </details>
  );
}

export default CollapsiblePanel;
