/**
 * App Header Component
 *
 * Application header with language switcher and user menu.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserDropdown } from '@/shared/components/common/UserDropdown';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';
import { useAuth } from '@/shared/contexts/AuthContext';
import { Menu } from 'lucide-react';

export interface AppHeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  className?: string;
}

export function AppHeader({
  onMenuClick,
  showMenuButton = false,
  className = '',
}: AppHeaderProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <header className={`h-14 border-b bg-card flex items-center justify-between px-4 ${className}`}>
      {/* Left: Menu Button (mobile) */}
      <div className="flex items-center gap-4">
        {showMenuButton && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Center: Title/Logo (optional) */}
      <div className="flex-1" />

      {/* Right: Language + User Menu */}
      <div className="flex items-center gap-3">
        <LanguageSwitcher variant="text" />
        {user && <UserDropdown />}
      </div>
    </header>
  );
}
