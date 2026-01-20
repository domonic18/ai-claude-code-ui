import React from 'react';
import { MessageSquare, Folder } from 'lucide-react';

export type MobileNavTab = 'chat' | 'files';

export interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: MobileNavTab) => void;
  isInputFocused: boolean;
}

interface NavItem {
  id: MobileNavTab;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

function MobileNav({ activeTab, setActiveTab, isInputFocused }: MobileNavProps) {
  const navItems: NavItem[] = [
    {
      id: 'chat',
      icon: MessageSquare,
      onClick: () => setActiveTab('chat')
    },
    {
      id: 'files',
      icon: Folder,
      onClick: () => setActiveTab('files')
    },
  ];

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 ios-bottom-safe transform transition-transform duration-300 ease-in-out shadow-lg ${
        isInputFocused ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="flex items-center justify-around py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              onTouchStart={(e) => {
                e.preventDefault();
                item.onClick();
              }}
              className={`flex items-center justify-center p-2 rounded-lg min-h-[40px] min-w-[40px] relative touch-manipulation ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              aria-label={item.id}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MobileNav;
