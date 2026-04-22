// 全局暗色模式状态管理：基于 localStorage 持久化 + 跟随系统偏好自动切换
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ThemeContextValue {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * 获取主题上下文的 Hook，必须在 ThemeProvider 内使用
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * 全局暗色模式 Provider：优先读取 localStorage 用户选择，其次跟随系统偏好，
 * 同步 <html> class 和 <meta> 标签以影响 Tailwind dark: 变量和移动端状态栏
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 优先读取用户显式选择，其次跟随系统偏好，默认浅色
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }

    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    return false;
  });

  // 同步 <html> class 和 <meta> 标签，影响 Tailwind dark: 变量和移动端状态栏颜色
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');

      const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (statusBarMeta) {
        statusBarMeta.setAttribute('content', 'black-translucent');
      }

      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', '#0c1117');
      }
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');

      const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (statusBarMeta) {
        statusBarMeta.setAttribute('content', 'default');
      }

      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', '#ffffff');
      }
    }
  }, [isDarkMode]);

  // 监听系统暗色模式变化，仅在用户未手动选择时跟随系统
  useEffect(() => {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 切换函数由 Context 暴露给所有子组件
  const toggleDarkMode = (): void => {
    setIsDarkMode(prev => !prev);
  };

  const value: ThemeContextValue = {
    isDarkMode,
    toggleDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
