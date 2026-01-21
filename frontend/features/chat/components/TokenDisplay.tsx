/**
 * TokenDisplay Component
 *
 * Displays token usage information.
 * Shows current token usage and budget.
 *
 * Features:
 * - Token usage bar
 * - Remaining tokens
 * - Percentage display
 * - Color-coded based on usage
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface TokenBudget {
  /** Total tokens available */
  total?: number;
  /** Tokens used */
  used?: number;
  /** Tokens remaining */
  remaining?: number;
  /** Percentage used */
  percentage?: number;
}

interface TokenDisplayProps {
  /** Token budget data */
  budget?: TokenBudget | null;
  /** Whether to show compact version */
  compact?: boolean;
}

/**
 * TokenDisplay Component
 */
export function TokenDisplay({ budget, compact = false }: TokenDisplayProps) {
  const { t } = useTranslation();

  // Calculate percentage if not provided
  const percentage = useMemo(() => {
    if (budget?.percentage !== undefined) {
      return budget.percentage;
    }
    if (budget?.total && budget?.used !== undefined) {
      return Math.round((budget.used / budget.total) * 100);
    }
    return null;
  }, [budget]);

  // Determine color based on usage
  const getColor = () => {
    if (percentage === null) return 'gray';
    if (percentage >= 90) return 'red';
    if (percentage >= 70) return 'yellow';
    return 'green';
  };

  const color = getColor();

  // Compact version
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-600 dark:text-gray-400">
          {percentage !== null ? `${percentage}%` : t('tokenDisplay.notAvailable')}
        </span>
        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          {percentage !== null && (
            <div
              className={`h-full bg-${color}-500 dark:bg-${color}-400 transition-all`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          )}
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('tokenDisplay.title')}
        </span>
        {percentage !== null && (
          <span className={`text-sm font-semibold text-${color}-600 dark:text-${color}-400`}>
            {percentage}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
        {percentage !== null && (
          <div
            className={`h-full bg-${color}-500 dark:bg-${color}-400 transition-all`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        )}
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>
          {budget?.used !== undefined
            ? `${budget.used.toLocaleString()} ${t('tokenDisplay.used')}`
            : t('tokenDisplay.notAvailable')}
        </span>
        <span>
          {budget?.remaining !== undefined
            ? `${budget.remaining.toLocaleString()} ${t('tokenDisplay.remaining')}`
            : budget?.total
            ? `${budget.total.toLocaleString()} ${t('tokenDisplay.total')}`
            : ''}
        </span>
      </div>
    </div>
  );
}

export default TokenDisplay;
