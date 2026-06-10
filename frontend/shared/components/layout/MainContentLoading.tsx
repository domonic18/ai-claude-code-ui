/*
 * MainContentLoading.tsx - Loading state view
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '@/shared/constants/app.constants';

interface MainContentLoadingProps {
  isMobile: boolean;
  onMenuClick: () => void;
}

/**
 * 主内容加载中视图：旋转动画 + 应用名称 + 移动端菜单按钮
 */
export function MainContentLoading({ isMobile, onMenuClick }: MainContentLoadingProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col">
      {isMobile && (
        <div className="bg-background border-b border-border p-2 sm:p-3 pwa-header-safe flex-shrink-0">
          <button
            onClick={onMenuClick}
            className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent pwa-menu-button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="w-12 h-12 mx-auto mb-4">
            <div
              className="w-full h-full rounded-full border-4 border-muted border-t-primary"
              style={{
                animation: 'spin 1s linear infinite',
                WebkitAnimation: 'spin 1s linear infinite',
                MozAnimation: 'spin 1s linear infinite'
              }}
            />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('mainContent.loadingApp', { appName: APP_NAME })}</h2>
          <p>{t('mainContent.settingUpWorkspace')}</p>
        </div>
      </div>
    </div>
  );
}
