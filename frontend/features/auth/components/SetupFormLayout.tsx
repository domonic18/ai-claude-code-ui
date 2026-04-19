/**
 * SetupFormLayout.tsx
 *
 * Layout component for SetupForm
 *
 * @module features/auth/components/SetupFormLayout
 */

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';
import { RegistrationFormFields } from './SetupForm';

interface SetupFormLayoutProps {
  username: string;
  password: string;
  confirmPassword: string;
  isLoading: boolean;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBackToLogin: () => void;
  t: (key: string) => string;
}

/**
 * SetupFormLayout Component
 *
 * Renders the complete layout for the setup/registration form.
 */
export function SetupFormLayout({
  username,
  password,
  confirmPassword,
  isLoading,
  error,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBackToLogin,
  t,
}: SetupFormLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Language Switcher */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher variant="button" />
      </div>

      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border border-border p-8 space-y-6">
          {/* Logo and Title */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <MessageSquare className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t('register.title')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('register.subtitle')}
            </p>
          </div>

          {/* Setup Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <RegistrationFormFields
              username={username}
              password={password}
              confirmPassword={confirmPassword}
              isLoading={isLoading}
              onUsernameChange={onUsernameChange}
              onPasswordChange={onPasswordChange}
              onConfirmPasswordChange={onConfirmPasswordChange}
              t={t}
            />

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
              {isLoading ? t('register.creating') : t('register.createAccount')}
            </button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('register.hasAccount')}
            </p>
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('register.backToLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetupFormLayout;
