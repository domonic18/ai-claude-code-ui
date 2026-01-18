/**
 * Language Hook
 *
 * Custom hook for managing language state and switching.
 */

import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

export interface UseLanguageReturn {
  currentLanguage: string;
  changeLanguage: (lng: string) => void;
  isEnglish: boolean;
  isChinese: boolean;
  t: (key: string) => string;
}

/**
 * Hook for managing application language
 */
export function useLanguage(): UseLanguageReturn {
  const { i18n, t } = useTranslation();

  const changeLanguage = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  }, [i18n]);

  const currentLanguage = i18n.language;

  return {
    currentLanguage,
    changeLanguage,
    isEnglish: currentLanguage === 'en',
    isChinese: currentLanguage === 'zh',
    t,
  };
}
