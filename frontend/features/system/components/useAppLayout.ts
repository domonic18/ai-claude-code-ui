/**
 * useAppLayout - Custom hook for AppContent layout state and effects
 *
 * @module features/system/components/useAppLayout
 */

import { useState, useEffect, useCallback } from 'react';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import type { SettingsTab } from '@/features/settings/types/settings.types';

// 由组件调用，自定义 Hook：useAppLayout
/**
 * Manages layout-related state: mobile detection, PWA, sidebar, settings panel
 */
export function useAppLayout() {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useLocalStorage('sidebarVisible', true);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage('sidebarWidth', 320);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('agents');
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('chat');

  // Chat display preferences
  const [autoExpandTools, setAutoExpandTools] = useLocalStorage('autoExpandTools', false);
  const [showRawParameters, setShowRawParameters] = useLocalStorage('showRawParameters', false);
  const [showThinking, setShowThinking] = useLocalStorage('showThinking', true);
  // 是否让模型启用 extended thinking（per-request 透传到后端 SDK，与上面的 showThinking
  // 仅控制"显示思考气泡"不同）。默认开；后端 env DISABLE_THINKING=1 优先级最高会强制关。
  const [extendedThinking, setExtendedThinking] = useLocalStorage('extendedThinking', true);
  const [autoScrollToBottom, setAutoScrollToBottom] = useLocalStorage('autoScrollToBottom', true);
  const [sendByCtrlEnter, setSendByCtrlEnter] = useLocalStorage('sendByCtrlEnter', false);
  const [autoRefreshInterval] = useLocalStorage('autoRefreshInterval', 0);

  // PWA detection
  useEffect(() => {
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsPWA(isStandalone);
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
    return () => mediaQuery.removeEventListener('change', checkPWA);
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Expose openSettings globally
  (window as any).openSettings = useCallback((tab: SettingsTab = 'agents') => {
    setSettingsInitialTab(tab);
    setShowSettings(true);
  }, []);

  return {
    isMobile, isPWA, isInputFocused,
    sidebarOpen, setSidebarOpen,
    sidebarVisible, setSidebarVisible,
    sidebarWidth, setSidebarWidth,
    showSettings, setShowSettings,
    settingsInitialTab,
    showQuickSettings, setShowQuickSettings,
    activeTab, setActiveTab,
    autoExpandTools, setAutoExpandTools,
    showRawParameters, setShowRawParameters,
    showThinking, setShowThinking,
    extendedThinking, setExtendedThinking,
    autoScrollToBottom, setAutoScrollToBottom,
    sendByCtrlEnter, setSendByCtrlEnter,
    autoRefreshInterval,
    setIsInputFocused,
  };
}
