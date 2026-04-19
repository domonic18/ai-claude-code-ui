/**
 * User Menu Component
 *
 * 底部用户菜单组件，参考 Manus 等主流应用的设计。
 *
 * 功能：
 * - 显示用户头像和用户名
 * - 点击展开下拉菜单
 * - 菜单包含：用户信息、语言切换、版本信息、设置、退出登录
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Settings, LogOut, Languages, ChevronUp, Shield, Brain } from 'lucide-react';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useUserRole } from '@/features/auth/hooks/useAuth';

/**
 * Custom hook for handling click outside to close dropdowns
 */
function useClickOutside(containerRef: React.RefObject<HTMLElement>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, containerRef]);
}

export interface UserMenuProps {
  onShowSettings?: () => void;
}

/**
 * User Menu Dropdown Component
 *
 * Renders the dropdown menu items when the user menu is open.
 */
interface UserMenuDropdownProps {
  displayName: string;
  onShowSettings?: () => void;
  isAdmin: boolean;
  onClose: () => void;
  onLogout: () => void;
}

function UserMenuDropdown({
  displayName,
  onShowSettings,
  isAdmin,
  onClose,
  onLogout
}: UserMenuDropdownProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
      {/* 用户信息区域 */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground">{t('common.loggedInAs')}</p>
        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
      </div>

      {/* 菜单项 */}
      <div className="py-1">
        {/* 语言切换 */}
        <div className="px-4 py-2 hover:bg-accent/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{t('common.language')}</span>
            </div>
            <LanguageSwitcher variant="text" />
          </div>
        </div>

        {/* 记忆管理 */}
        <Link
          to="/memory"
          onClick={onClose}
          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/50 transition-colors"
        >
          <Brain className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">{t('memory.title')}</span>
        </Link>

        {/* 设置 */}
        {onShowSettings && (
          <button
            onClick={() => {
              onShowSettings();
              onClose();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/50 transition-colors"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{t('common.settings')}</span>
          </button>
        )}

        {/* 管理控制台 - 仅对管理员显示 */}
        {isAdmin && (
          <Link
            to="/admin"
            onClick={onClose}
            className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/50 transition-colors"
          >
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{t('common.adminConsole')}</span>
          </Link>
        )}

        {/* 退出登录 */}
        <button
          onClick={onLogout}
          className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/50 transition-colors text-red-600 dark:text-red-400"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">{t('common.logout')}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * User Menu Button - triggers the dropdown
 */
function UserMenuButton({ displayName, userInitial, isOpen, onClick }: {
  displayName: string; userInitial: string; isOpen: boolean; onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors duration-200"
      aria-label={t('common.userMenu')} aria-expanded={isOpen}
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-white">{userInitial}</span>
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
      </div>
      <ChevronUp className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}

export const UserMenu = ({
  onShowSettings,
}: UserMenuProps) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { isAdmin } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, isOpen, () => setIsOpen(false));

  const handleLogout = useCallback(async () => {
    await logout();
    setIsOpen(false);
  }, [logout]);

  const displayName = user?.username || t('common.user') || 'User';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <UserMenuButton
        displayName={displayName} userInitial={userInitial}
        isOpen={isOpen} onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <UserMenuDropdown
          displayName={displayName} onShowSettings={onShowSettings}
          isAdmin={isAdmin} onClose={() => setIsOpen(false)} onLogout={handleLogout}
        />
      )}
    </div>
  );
};

export default UserMenu;
