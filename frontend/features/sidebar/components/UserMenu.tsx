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

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Settings, LogOut, Languages, ChevronUp, Shield } from 'lucide-react';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';
import { useAuth } from '@/shared/contexts/AuthContext';

export interface UserMenuProps {
  onShowSettings?: () => void;
}

export const UserMenu = ({
  onShowSettings,
}: UserMenuProps) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const handleSettings = () => {
    onShowSettings?.();
    setIsOpen(false);
  };

  // 获取用户名显示
  const displayName = user?.username || t('common.user') || 'User';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      {/* 用户头像按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors duration-200"
        aria-label={t('common.userMenu')}
        aria-expanded={isOpen}
      >
        {/* 用户头像 */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-white">{userInitial}</span>
        </div>

        {/* 用户名 */}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
        </div>

        {/* 箭头图标 */}
        <ChevronUp
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
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

            {/* 设置 */}
            {onShowSettings && (
              <button
                onClick={handleSettings}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/50 transition-colors"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{t('common.settings')}</span>
              </button>
            )}

            {/* 管理控制台 */}
            <Link
              to="/admin"
              onClick={() => setIsOpen(false)}
              className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/50 transition-colors"
            >
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">管理控制台</span>
            </Link>

            {/* 退出登录 */}
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/50 transition-colors text-red-600 dark:text-red-400"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">{t('common.logout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
