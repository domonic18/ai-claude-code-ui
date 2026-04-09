/**
 * i18n Configuration
 *
 * Internationalization setup for the application.
 * Supports English (en) and Chinese (zh) languages.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zh from './locales/zh.json';

// Get saved language preference or default to English
const savedLanguage = localStorage.getItem('language') || 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    detection: {
      // Only use localStorage, don't auto-detect from browser
      order: ['localStorage'],
      caches: ['localStorage'],
      // Don't lookup language from browser settings
      lookupLocalStorage: 'language',
    },

    react: {
      useSuspense: false,
    },
  });

// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

/**
 * Translation function for non-React components (services, utilities, etc.)
 * Use this in places where useTranslation hook is not available.
 *
 * @param key - Translation key (e.g., 'auth.error.loginFailed')
 * @param options - Options for interpolation
 * @returns Translated string
 */
export function t(key: string, options?: Record<string, any>): string {
  return i18n.t(key, options);
}

/**
 * Get current language
 */
export function getCurrentLanguage(): string {
  return i18n.language;
}

export default i18n;
