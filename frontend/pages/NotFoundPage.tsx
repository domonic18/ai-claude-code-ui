import React from 'react';
import { Home, Search } from 'lucide-react';

/**
 * Not Found Page Component Props
 */
export interface NotFoundPageProps {
  /** The path that was not found */
  path?: string;
  /** Callback when home button is clicked */
  onHome?: () => void;
  /** Callback when go back button is clicked */
  onGoBack?: () => void;
  /** Suggested navigation links */
  suggestions?: Array<{
    label: string;
    href: string;
    onClick?: () => void;
  }>;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Not Found Page Component (404)
 *
 * Displays a friendly 404 error page with navigation options.
 *
 * @example
 * ```tsx
 * <NotFoundPage
 *   path="/some/unknown/path"
 *   suggestions={[
 *     { label: 'Dashboard', href: '/dashboard' },
 *     { label: 'Projects', href: '/projects' }
 *   ]}
 *   onHome={() => navigate('/')}
 * />
 * ```
 */
const NotFoundPage: React.FC<NotFoundPageProps> = ({
  path,
  onHome,
  onGoBack,
  suggestions = [],
  className = ''
}) => {
  const handleHome = () => {
    if (onHome) {
      onHome();
    } else {
      window.location.href = '/';
    }
  };

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      window.history.back();
    }
  };

  const handleSuggestionClick = (suggestion: typeof suggestions[0]) => {
    if (suggestion.onClick) {
      suggestion.onClick();
    } else if (suggestion.href) {
      window.location.href = suggestion.href;
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 ${className}`}>
      <div className="max-w-lg w-full text-center">
        {/* 404 Text */}
        <div className="mb-6">
          <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-800 select-none">
            404
          </h1>
        </div>

        {/* Search Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <Search className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>

        {/* Main Message */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>

        {/* Path Display */}
        {path && (
          <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <code className="text-sm text-gray-700 dark:text-gray-300 break-all">
              {path}
            </code>
          </div>
        )}

        {/* Suggested Links */}
        {suggestions.length > 0 && (
          <div className="mb-8">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              You might be looking for:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleGoBack}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Go Back
          </button>
          <button
            onClick={handleHome}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
