/**
 * PWA Hook
 *
 * Hook for Progressive Web App functionality.
 */

import { useState, useEffect } from 'react';
import type { PWAStatus } from '../types';

/**
 * Hook for PWA detection and management
 */
export interface UsePWAReturn {
  isPWA: boolean;
  pwaStatus: PWAStatus;
}

export function usePWA(): UsePWAReturn {
  const [pwaStatus, setPWAStatus] = useState<PWAStatus>({
    isPWA: false,
    isStandalone: false,
    displayMode: 'browser',
  });

  useEffect(() => {
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');

      const displayMode = isStandalone ? 'standalone' : 'browser';

      const status: PWAStatus = {
        isPWA: isStandalone,
        isStandalone,
        displayMode,
      };

      setPWAStatus(status);

      // Enable touch action for PWA
      document.addEventListener('touchstart', () => {}, { passive: true });

      if (isStandalone) {
        document.documentElement.classList.add('pwa-mode');
        document.body.classList.add('pwa-mode');
      } else {
        document.documentElement.classList.remove('pwa-mode');
        document.body.classList.remove('pwa-mode');
      }
    };

    checkPWA();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkPWA);

    return () => {
      mediaQuery.removeEventListener('change', checkPWA);
    };
  }, []);

  return {
    isPWA: pwaStatus.isPWA,
    pwaStatus,
  };
}
