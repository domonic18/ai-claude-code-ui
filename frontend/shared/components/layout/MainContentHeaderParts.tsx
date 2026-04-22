/*
 * MainContentHeaderParts.tsx - Sub-components for MainContentHeader
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClaudeLogo, CursorLogo } from '@/shared/assets/icons';
import Tooltip from '@/shared/components/ui/Tooltip';

interface Session {
  __provider?: string;
  name?: string;
  summary?: string;
  title?: string;
  [key: string]: any;
}

interface Project {
  displayName?: string;
  [key: string]: any;
}

interface MobileMenuButtonProps {
  onMenuClick: () => void;
}

/**
 * 移动端汉堡菜单按钮：触摸优化，带 active 缩放反馈
 */
export function MobileMenuButton({ onMenuClick }: MobileMenuButtonProps) {
  return (
    <button
      onClick={onMenuClick}
      onTouchStart={(e) => {
        e.preventDefault();
        onMenuClick();
      }}
      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 touch-manipulation active:scale-95 pwa-menu-button flex-shrink-0"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

interface SessionProjectTitleProps {
  activeTab: string;
  selectedSession?: Session | null;
  selectedProject?: Project | null;
}

/**
 * 会话/项目标题区：根据当前 Tab 显示对应 Logo、会话名称或项目名
 */
export function SessionProjectTitle({ activeTab, selectedSession, selectedProject }: SessionProjectTitleProps) {
  const { t } = useTranslation();

  const getLogoComponent = () => {
    if (activeTab !== 'chat' || !selectedSession) return null;

    return (
      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
        {selectedSession.__provider === 'cursor' ? (
          <CursorLogo className="w-4 h-4" />
        ) : (
          <ClaudeLogo className="w-4 h-4" />
        )}
      </div>
    );
  };

  const getTitleContent = () => {
    if (activeTab === 'chat' && selectedSession) {
      return (
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white whitespace-nowrap overflow-x-auto scrollbar-hide">
            {selectedSession.summary || selectedSession.name || selectedSession.title || (selectedSession.__provider === 'cursor' ? t('common.untitledSession') : t('common.newSession'))}
          </h2>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {selectedProject?.displayName}
          </div>
        </div>
      );
    }

    if (activeTab === 'chat' && !selectedSession) {
      return (
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
            {t('common.newSession')}
          </h2>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {selectedProject?.displayName}
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-0">
        <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
          {activeTab === 'files' ? t('common.projectFiles') : t('common.project')}
        </h2>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {selectedProject?.displayName}
        </div>
      </div>
    );
  };

  return (
    <div className="min-w-0 flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
      {getLogoComponent()}
      <div className="min-w-0 flex-1">
        {getTitleContent()}
      </div>
    </div>
  );
}

interface TabNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
}

/**
 * Tab 导航栏：聊天 / Shell / 文件 三个标签页切换，带 Tooltip 提示
 */
export function TabNavigation({ activeTab, setActiveTab, isAdmin }: TabNavigationProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-shrink-0 hidden sm:block">
      <div className="relative flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1" data-tour="tab-nav">
        <Tooltip content={t('common.chat')} position="bottom">
          <button
            onClick={() => setActiveTab('chat')}
            className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center gap-1 sm:gap-1.5">
              <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="hidden md:hidden lg:inline">{t('common.chat')}</span>
            </span>
          </button>
        </Tooltip>
        {isAdmin && (
          <Tooltip content={t('common.shell')} position="bottom">
            <button
              onClick={() => setActiveTab('shell')}
              className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'shell'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-1 sm:gap-1.5">
                <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="hidden md:hidden lg:inline">{t('common.shell')}</span>
              </span>
            </button>
          </Tooltip>
        )}
        <Tooltip content={t('common.files')} position="bottom">
          <button
            onClick={() => setActiveTab('files')}
            className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'files'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center gap-1 sm:gap-1.5">
              <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="hidden md:hidden lg:inline">{t('common.files')}</span>
            </span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
