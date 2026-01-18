import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading Page Component Props
 */
export interface LoadingPageProps {
  /** Loading message to display */
  message?: string;
  /** Detailed description of what's loading */
  description?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Whether to show progress bar */
  showProgress?: boolean;
  /** Estimated time remaining (in seconds) */
  estimatedTime?: number;
  /** Timeout in milliseconds before showing "taking longer" message */
  timeout?: number;
  /** Custom icon or element */
  icon?: React.ReactNode;
  /** Whether to use a minimal/smaller version */
  minimal?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Loading Page Component
 *
 * Displays a loading page with optional progress bar and timeout handling.
 *
 * @example
 * ```tsx
 * <LoadingPage
 *   message="Loading your workspace..."
 *   progress={45}
 *   showProgress={true}
 *   estimatedTime={30}
 * />
 * ```
 */
const LoadingPage: React.FC<LoadingPageProps> = ({
  message = 'Loading...',
  description,
  progress,
  showProgress = false,
  estimatedTime,
  timeout = 30000, // 30 seconds default
  icon,
  minimal = false,
  className = ''
}) => {
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  useEffect(() => {
    if (timeout > 0) {
      const timer = setTimeout(() => {
        setIsTakingLonger(true);
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [timeout]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (minimal) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-center">
          {icon || <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-2" />}
          {message && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 ${className}`}>
      <div className="max-w-md w-full text-center">
        {/* Loading Icon */}
        <div className="flex justify-center mb-6">
          {icon || (
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Message */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {message}
          </h1>
          {description && (
            <p className="text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        {showProgress && progress !== undefined && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {progress}%
            </p>
          </div>
        )}

        {/* Estimated Time */}
        {estimatedTime !== undefined && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Estimated time: {formatTime(estimatedTime)}
            </p>
          </div>
        )}

        {/* Taking Longer Message */}
        {isTakingLonger && (
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              This is taking longer than expected. Please wait...
            </p>
          </div>
        )}

        {/* Loading Dots Animation */}
        <div className="mt-6 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.6s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;
