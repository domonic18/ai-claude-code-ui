import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/shared/contexts/AuthContext';
import { SetupFormLayout } from './SetupFormLayout';

/**
 * Registration form fields component
 */
export interface RegistrationFormFieldsProps {
  username: string;
  password: string;
  confirmPassword: string;
  isLoading: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  t: (key: string) => string;
}

export function RegistrationFormFields({
  username,
  password,
  confirmPassword,
  isLoading,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  t,
}: RegistrationFormFieldsProps) {
  return (
    <>
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
          {t('login.username')}
        </label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('login.usernamePlaceholder')}
          autoComplete="username"
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
          {t('register.password')}
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('register.passwordPlaceholder')}
          autoComplete="new-password"
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
          {t('register.confirmPassword')}
        </label>
        <input
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('register.confirmPasswordPlaceholder')}
          autoComplete="new-password"
          required
          disabled={isLoading}
        />
      </div>
    </>
  );
}

/**
 * Validate registration form
 */
function validateRegistrationForm(
  username: string,
  password: string,
  confirmPassword: string,
  t: (key: string) => string
): string | null {
  if (password !== confirmPassword) {
    return t('register.passwordMismatch');
  }

  if (username.length < 3) {
    return t('register.usernameTooShort');
  }

  if (password.length < 6) {
    return t('register.passwordTooShort');
  }

  return null;
}

const SetupForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateRegistrationForm(username, password, confirmPassword, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    const result = await register(username, password);

    if (result.success) {
      // Redirect to chat page on successful registration
      navigate('/chat');
    } else {
      setError(result.error || t('register.failed'));
      setIsLoading(false);
    }
  };

  return (
    <SetupFormLayout
      username={username}
      password={password}
      confirmPassword={confirmPassword}
      isLoading={isLoading}
      error={error}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onConfirmPasswordChange={setConfirmPassword}
      onSubmit={handleSubmit}
      onBackToLogin={() => navigate('/login')}
      t={t}
    />
  );
};

export default SetupForm;
