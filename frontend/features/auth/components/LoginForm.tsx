/**
 * 登录页组件
 *
 * 认证方式：仅 SAML SSO 登录（密码登录已移除）。
 * SAML 状态来自 /api/auth/saml/status，未启用/未配置时显示提示。
 */

// React 核心库导入
import React, { useState, useEffect } from 'react';
// 国际化翻译钩子
import { useTranslation } from 'react-i18next';
// UI 图标组件库
import { MessageSquare, LogIn, AlertCircle } from 'lucide-react';
// 语言切换器组件
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';

/**
 * SAML SSO 状态接口
 * 定义 SAML 配置的状态信息
 */
interface SamlStatus {
  /** SAML 功能是否已启用 */
  enabled: boolean;
  /** SAML 是否已完成配置 */
  configured: boolean;
}

// 常量定义：SAML 配置状态检查端点
const SAML_STATUS_ENDPOINT = '/api/auth/saml/status';

/**
 * 执行 SAML 登录流程
 *
 * 向后端发起 SAML SSO 初始化请求，成功后重定向到身份提供商（IdP）。
 * @param {Function} setError - 设置错误消息的函数
 * @param {Function} t - 国际化翻译函数
 */
async function handleSamlLogin(setError: (error: string) => void, t: (key: string) => string): Promise<void> {
  try {
    // SAML 初始化 API 端点
    const initUrl = '/api/auth/saml/init';

    // 发送 SAML 初始化请求，指定登录成功后返回聊天页面
    const response = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        return_to: '/chat'
      }),
      credentials: 'include'  // 包含 cookie 用于会话管理
    });

    // 检查响应状态
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setError(`${t('auth.error.ssoInitFailed')}: ${errorData.error || response.statusText}`);
      return;
    }

    // 解析响应数据
    const data = await response.json();

    // 如果返回了登录 URL，重定向到身份提供商
    if (data.login_url) {
      window.location.href = data.login_url;
    } else {
      // 响应中未包含登录 URL
      setError(t('auth.error.ssoUrlNotReceived'));
    }
  } catch (err) {
    // 网络错误或其他异常
    setError(t('auth.error.ssoConnectionFailed'));
  }
}

/**
 * 登录页面头部区域组件
 *
 * 显示应用 Logo、标题和副标题。
 */
const LoginHeader: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="text-center">
      {/* 应用 Logo 图标 */}
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
          <MessageSquare className="w-8 h-8 text-primary-foreground" />
        </div>
      </div>
      {/* 欢迎标题 */}
      <h1 className="text-2xl font-bold text-foreground">{t('login.welcome')}</h1>
      {/* 副标题描述 */}
      <p className="text-muted-foreground mt-2">
        {t('login.subtitle')}
      </p>
    </div>
  );
};

/**
 * LoginForm 主组件
 *
 * SSO-only 登录页：挂载时检查 SAML 状态，用户点击按钮跳转 IdP 登录。
 */
const LoginForm: React.FC = () => {
  // 国际化翻译钩子
  const { t } = useTranslation();
  // 错误消息（显示 SSO 登录失败原因）
  const [error, setError] = useState('');
  // SAML 状态：SAML 功能是否启用和配置完成
  const [samlStatus, setSamlStatus] = useState<SamlStatus>({ enabled: false, configured: false });
  // SAML 状态：是否正在检查 SAML 配置状态
  const [isLoadingSaml, setIsLoadingSaml] = useState(true);

  /**
   * 组件挂载时检查 SAML 配置状态
   */
  useEffect(() => {
    const checkSamlStatus = async () => {
      try {
        const response = await fetch(SAML_STATUS_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          setSamlStatus(data);
        }
      } finally {
        // 无论请求成功与否，都结束加载状态（确保 UI 正常显示）
        setIsLoadingSaml(false);
      }
    };

    checkSamlStatus();
  }, []);

  const ssoAvailable = samlStatus.enabled && samlStatus.configured;

  return (
    // 页面容器：全屏高度，垂直水平居中
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* 语言切换器：固定在右上角 */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher variant="button" />
      </div>

      {/* 登录卡片容器 */}
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border border-border p-8 space-y-6">
          {/* 头部：Logo 和标题 */}
          <LoginHeader />

          {/* SAML 未启用/未配置提示 */}
          {!isLoadingSaml && !ssoAvailable && (
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t('auth.ssoNotConfigured')}
              </p>
            </div>
          )}

          {/* SSO 登录按钮 */}
          {ssoAvailable && (
            <button
              type="button"
              onClick={() => handleSamlLogin(setError, t)}
              disabled={isLoadingSaml}
              className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-md border border-gray-300 dark:border-gray-600 transition-colors duration-200"
            >
              <LogIn className="w-4 h-4" />
              {t('auth.ssoSignIn')}
            </button>
          )}

          {/* SSO 错误消息显示区域 */}
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
