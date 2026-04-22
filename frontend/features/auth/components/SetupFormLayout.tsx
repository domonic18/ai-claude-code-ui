/**
 * SetupFormLayout.tsx
 *
 * Layout component for SetupForm
 *
 * @module features/auth/components/SetupFormLayout
 */

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';
import { RegistrationFormFields } from './SetupForm';

/**
 * SetupForm 组件的属性接口
 * 定义了初始化/注册表单布局所需的所有数据和回调函数
 */
interface SetupFormLayoutProps {
  /** 用户名输入值 */
  username: string;
  /** 密码输入值 */
  password: string;
  /** 确认密码输入值 */
  confirmPassword: string;
  /** 是否处于加载状态 */
  isLoading: boolean;
  /** 错误消息文本 */
  error: string;
  /** 用户名变更回调 */
  onUsernameChange: (value: string) => void;
  /** 密码变更回调 */
  onPasswordChange: (value: string) => void;
  /** 确认密码变更回调 */
  onConfirmPasswordChange: (value: string) => void;
  /** 表单提交回调 */
  onSubmit: (e: React.FormEvent) => void;
  /** 返回登录页面的回调 */
  onBackToLogin: () => void;
  /** 国际化翻译函数 */
  t: (key: string) => string;
}

/**
 * SetupFormLayout 组件
 *
 * 渲染完整的初始化/注册表单布局，包括 Logo、表单字段和导航按钮。
 * 该组件负责展示层逻辑，不处理表单验证或提交。
 */
export function SetupFormLayout({
  username,
  password,
  confirmPassword,
  isLoading,
  error,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBackToLogin,
  t,
}: SetupFormLayoutProps): JSX.Element {
  return (
    // 页面容器：全屏高度，垂直水平居中，响应式内边距
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* 语言切换器：固定在右上角 */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher variant="button" />
      </div>

      {/* 表单卡片容器：最大宽度，带阴影和圆角 */}
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border border-border p-8 space-y-6">
          {/* Logo 和标题区域 */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {/* 应用图标：蓝色圆角正方形，包含消息图标 */}
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <MessageSquare className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            {/* 注册表单标题 */}
            <h1 className="text-2xl font-bold text-foreground">{t('register.title')}</h1>
            {/* 副标题文本 */}
            <p className="text-muted-foreground mt-2">
              {t('register.subtitle')}
            </p>
          </div>

          {/* 注册表单 */}
          <form onSubmit={onSubmit} className="space-y-4">
            {/* 表单输入字段组件 */}
            <RegistrationFormFields
              username={username}
              password={password}
              confirmPassword={confirmPassword}
              isLoading={isLoading}
              onUsernameChange={onUsernameChange}
              onPasswordChange={onPasswordChange}
              onConfirmPasswordChange={onConfirmPasswordChange}
              t={t}
            />

            {/* 错误消息提示：仅在存在错误时显示 */}
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* 提交按钮：加载时禁用并显示不同文本 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
              {isLoading ? t('register.creating') : t('register.createAccount')}
            </button>
          </form>

          {/* 底部导航：返回登录页面 */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('register.hasAccount')}
            </p>
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('register.backToLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetupFormLayout;
