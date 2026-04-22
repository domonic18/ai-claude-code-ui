import React from 'react';

/**
 * Settings panel layout component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the panel is open
 * @param {boolean} props.isMobile - Whether in mobile view
 * @param {React.ReactNode} props.children - Panel content
 */
interface SettingsPanelLayoutProps {
  isOpen: boolean;
  isMobile: boolean;
  children: React.ReactNode;
}

/**
 * 设置面板布局：右侧滑出面板，适配桌面/移动端
 */
const SettingsPanelLayout = ({ isOpen, isMobile, children }: SettingsPanelLayoutProps) => {
  return (
    <div
      className={`fixed top-0 right-0 h-full w-64 bg-background border-l border-border shadow-xl transform transition-transform duration-150 ease-out z-40 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${isMobile ? 'h-screen' : ''}`}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Settings</h3>
        </div>

        {/* Settings Content */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 bg-background ${isMobile ? 'pb-mobile-nav' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanelLayout;
