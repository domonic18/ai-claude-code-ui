/**
 * Login Form Component
 *
 * User authentication form with internationalization support.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/shared/contexts/AuthContext';
import { MessageSquare, UserPlus, LogIn } from 'lucide-react';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';

interface SamlStatus {
  enabled: boolean;
  configured: boolean;
}

/**
 * Performs SAML login by initiating SSO flow and redirecting to IdP
 * @param setError - Function to set error message
 * @param t - Translation function
 */
async function handleSamlLogin(setError: (error: string) => void, t: (key: string) => string): Promise<void> {
  try {
    const initUrl = '/api/auth/saml/init';

    const response = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        return_to: '/chat'
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setError(`${t('auth.error.ssoInitFailed')}: ${errorData.error || response.statusText}`);
      return;
    }

    const data = await response.json();

    if (data.login_url) {
      window.location.href = data.login_url;
    } else {
      setError(t('auth.error.ssoUrlNotReceived'));
    }
  } catch (err) {
    setError(t('auth.error.ssoConnectionFailed'));
  }
}

/**
 * Handles form submission for username/password login
 * @param username - Username input
 * @param password - Password input
 * @param setIsLoading - Function to set loading state
 * @param setError - Function to set error message
 * @param login - Login function from auth context
 * @param navigate - Navigation function
 * @param t - Translation function
 */
async function handleSubmit(
  username: string,
  password: string,
  setIsLoading: (value: boolean) => void,
  setError: (error: string) => void,
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>,
  navigate: (path: string) => void,
  t: (key: string) => string,
  e: React.FormEvent
): Promise<void> {
  e.preventDefault();
  setError('');

  if (!username || !password) {
    setError(t('login.error'));
    return;
  }

  setIsLoading(true);

  const result = await login(username, password);

  if (result.success) {
    navigate('/chat');
  } else {
    setError(result.error || t('login.error'));
    setIsLoading(false);
  }
}

/**
 * Form fields component for login inputs
 */
interface LoginFormFieldsProps {
  username: string;
  password: string;
  isLoading: boolean;
  error: string;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const LoginFormFields: React.FC<LoginFormFieldsProps> = ({
  username,
  password,
  isLoading,
  error,
  setUsername,
  setPassword,
  onSubmit
}) => {
  const { t } = useTranslation();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
  );
};

/**
 * SAML SSO login button section
 */
interface SamlLoginSectionProps {
  isLoadingSaml: boolean;
  samlStatus: SamlStatus;
  onSamlLogin: () => void;
}

const SamlLoginSection: React.FC<SamlLoginSectionProps> = ({
  isLoadingSaml,
  samlStatus,
  onSamlLogin
}) => {
  const { t } = useTranslation();

  if (isLoadingSaml || !samlStatus.enabled || !samlStatus.configured) {
    return null;
  }

  return (
    <>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-muted-foreground">{t('auth.or')}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onSamlLogin}
        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-md border border-gray-300 dark:border-gray-600 transition-colors duration-200"
      >
        <LogIn className="w-4 h-4" />
        {t('auth.ssoSignIn')}
      </button>
    </>
  );
};

/**
 * Footer section with first-time setup link
 */
interface LoginFooterProps {
  onFirstTimeSetup: () => void;
}

const LoginFooter: React.FC<LoginFooterProps> = ({ onFirstTimeSetup }) => {
  const { t } = useTranslation();

  return (
    <div className="text-center space-y-2">
      <p className="text-sm text-muted-foreground">
        {t('login.credentials')}
      </p>
      <button
        type="button"
        onClick={onFirstTimeSetup}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 mx-auto"
      >
        <UserPlus className="w-3 h-3" />
        {t('login.firstTime')}
      </button>
    </div>
  );
};

/**
 * Header section with logo and title
 */
const LoginHeader: React.FC = () => {
  const { t } = useTranslation();

  return (
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
  );
};

const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [samlStatus, setSamlStatus] = useState<SamlStatus>({ enabled: false, configured: false });
  const [isLoadingSaml, setIsLoadingSaml] = useState(true);

  const { login } = useAuth();

  useEffect(() => {
    const checkSamlStatus = async () => {
      try {
        const response = await fetch('/api/auth/saml/status');
        if (response.ok) {
          const data = await response.json();
          setSamlStatus(data);
        }
      } finally {
        setIsLoadingSaml(false);
      }
    };

    checkSamlStatus();
  }, []);

  const onSamlLogin = () => {
    handleSamlLogin(setError, t);
  };

  const onSubmitForm = (e: React.FormEvent) => {
    handleSubmit(username, password, setIsLoading, setError, login, navigate, t, e);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher variant="button" />
      </div>

      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border border-border p-8 space-y-6">
          <LoginHeader />

          <LoginFormFields
            username={username}
            password={password}
            isLoading={isLoading}
            error={error}
            setUsername={setUsername}
            setPassword={setPassword}
            onSubmit={onSubmitForm}
          />

          <SamlLoginSection
            isLoadingSaml={isLoadingSaml}
            samlStatus={samlStatus}
            onSamlLogin={onSamlLogin}
          />

          <LoginFooter onFirstTimeSetup={() => navigate('/register')} />
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
