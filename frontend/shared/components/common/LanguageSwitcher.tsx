/**
 * Language Switcher Component
 *
 * Button component for toggling between English and Chinese.
 */

import React from 'react';
import { useLanguage } from '@/shared/hooks/useLanguage';

export interface LanguageSwitcherProps {
  className?: string;
  variant?: 'button' | 'text';
}

export function LanguageSwitcher({
  className = '',
  variant = 'button',
}: LanguageSwitcherProps) {
  const { currentLanguage, changeLanguage, isEnglish, isChinese, t } = useLanguage();

  const handleToggle = () => {
    changeLanguage(isEnglish ? 'zh' : 'en');
  };

  if (variant === 'text') {
    return (
      <button
        onClick={handleToggle}
        className={`text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${className}`}
        aria-label={t('common.language')}
      >
        {isEnglish ? '中文' : 'EN'}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors duration-200 ${className}`}
      aria-label={t('common.language')}
      title={t('common.language')}
    >
      {isEnglish ? '中文' : 'EN'}
    </button>
  );
}
