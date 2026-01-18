/**
 * Login Form Component
 *
 * User authentication form with internationalization support.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/shared/contexts/AuthContext';
import { MessageSquare, UserPlus } from 'lucide-react';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';

const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleFirstTimeSetup = () => {
    navigate('/register');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError(t('login.error'));
      return;
    }

    setIsLoading(true);

    const result = await login(username, password);

    if (result.success) {
      // Redirect to chat page on successful login
      navigate('/chat');
    } else {
      setError(result.error || t('login.error'));
      setIsLoading(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-foreground">{t('login.welcome')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('login.subtitle')}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
                {t('login.username')}
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                {t('login.password')}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                {error.includes('Invalid username or password') && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    {t('login.setupHint')}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
              {isLoading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('login.credentials')}
            </p>
            <button
              type="button"
              onClick={handleFirstTimeSetup}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <UserPlus className="w-3 h-3" />
              {t('login.firstTime')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
