import React from 'react';
import { AlertCircle, Home, RotateCcw } from 'lucide-react';

/**
 * Error Page Component Props
 */
export interface ErrorPageProps {
  /** Error code (e.g., 500, 503) */
  code?: number;
  /** Error message to display */
  message?: string;
  /** Detailed error description */
  details?: string;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Callback when home button is clicked */
  onHome?: () => void;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Error Page Component
 *
 * Displays a user-friendly error page with optional retry and home navigation.
 *
 * @example
 * ```tsx
 * <ErrorPage
 *   code={500}
 *   message="Internal Server Error"
 *   details="Something went wrong on our end. Please try again later."
 *   onRetry={() => window.location.reload()}
 *   onHome={() => navigate('/')}
 * />
 * ```
 */
const ErrorPage: React.FC<ErrorPageProps> = ({
  code = 500,
  message = 'Something went wrong',
  details,
  onRetry,
  onHome,
  className = ''
}) => {
  const handleHome = () => {
    if (onHome) {
      onHome();
    } else {
      window.location.href = '/';
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 ${className}`}>
      <div className="max-w-md w-full">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Error Code */}
        {code && (
          <div className="text-center mb-4">
            <span className="text-6xl font-bold text-gray-300 dark:text-gray-700">
              {code}
            </span>
          </div>
        )}

        {/* Error Message */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            {message}
          </h1>
          {details && (
            <p className="text-gray-600 dark:text-gray-400">
              {details}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry !== null && (
            <button
              onClick={handleRetry}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          )}
          <button
            onClick={handleHome}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>

        {/* Additional Help Text */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-500">
          <p>If the problem persists, please contact support.</p>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
