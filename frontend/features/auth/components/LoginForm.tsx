/**
 * 登录表单组件
 *
 * 提供用户名/密码登录和 SAML SSO 登录功能，支持国际化。
 * 包含表单验证、错误处理和 SAML 状态检查。
 */

// React 核心库导入
import React, { useState, useEffect } from 'react';
// React Router 导航钩子
import { useNavigate } from 'react-router-dom';
// 国际化翻译钩子
import { useTranslation } from 'react-i18next';
// 认证上下文钩子
import { useAuth } from '@/shared/contexts/AuthContext';
// UI 图标组件库
import { MessageSquare, UserPlus, LogIn } from 'lucide-react';
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

// 常量定义：表单验证规则
const VALIDATION_RULES = {
  MIN_USERNAME_LENGTH: 1,  // 用户名最小长度
  MIN_PASSWORD_LENGTH: 1   // 密码最小长度
};

/**
 * 处理用户名/密码登录表单提交
 *
 * 执行客户端验证，调用登录 API，根据结果导航或显示错误。
 * @param {string} username - 用户名输入
 * @param {string} password - 密码输入
 * @param {Function} setIsLoading - 设置加载状态的函数
 * @param {Function} setError - 设置错误消息的函数
 * @param {Function} login - 来自认证上下文的登录函数
 * @param {Function} navigate - 路由导航函数
 * @param {Function} t - 国际化翻译函数
 * @param {React.FormEvent} e - 表单事件对象
 */
async function handleSubmit(
  username: string,
  password: string,
  setIsLoading: (value: boolean) => void,
  setError: (error: string) => void,
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>,
  navigate: (path: string) => void,
  t: (key: string) => string,
  e: React.FormEvent
): Promise<void> {
  // 阻止表单默认提交行为
  e.preventDefault();
  // 清空之前的错误消息
  setError('');

  // 客户端验证：确保用户名和密码不为空
  if (!username || !password) {
    setError(t('login.error'));
    return;
  }

  // 进入加载状态
  setIsLoading(true);

  // 调用登录 API
  const result = await login(username, password);

  if (result.success) {
    // 登录成功：导航到聊天页面
    navigate('/chat');
  } else {
    // 登录失败：显示错误消息并退出加载状态
    setError(result.error || t('login.error'));
    setIsLoading(false);
  }
}

// 常量定义：UI 文本和占位符
const UI_TEXT = {
  USERNAME_LABEL: 'login.username',
  PASSWORD_LABEL: 'login.password',
  SUBMIT_BUTTON: 'login.signIn',
  SUBMITTING_BUTTON: 'login.signingIn'
};

/**
 * 登录表单字段组件的属性接口
 */
interface LoginFormFieldsProps {
  /** 用户名输入值 */
  username: string;
  /** 密码输入值 */
  password: string;
  /** 是否处于加载状态 */
  isLoading: boolean;
  /** 错误消息文本 */
  error: string;
  /** 设置用户名的回调 */
  setUsername: (value: string) => void;
  /** 设置密码的回调 */
  setPassword: (value: string) => void;
  /** 表单提交回调 */
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * 登录表单字段组件
 *
 * 渲染用户名和密码输入字段，包括错误消息显示和提交按钮。
 */
const LoginFormFields: React.FC<LoginFormFieldsProps> = ({
  username,
  password,
  isLoading,
  error,
  setUsername,
  setPassword,
  onSubmit
}) => {
  const { t } = useTranslation();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* 用户名输入字段 */}
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
          {t('login.username')}
        </label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('login.usernamePlaceholder')}
          autoComplete="username"
          required
          disabled={isLoading}
        />
      </div>

      {/* 密码输入字段 */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
          {t('login.password')}
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('login.passwordPlaceholder')}
          autoComplete="current-password"
          required
          disabled={isLoading}
        />
      </div>

      {/* 错误消息显示区域 */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          {/* 如果是凭据无效错误，显示首次设置提示 */}
          {error.includes('Invalid username or password') && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              {t('login.setupHint')}
            </p>
          )}
        </div>
      )}

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
      >
        {isLoading ? t('login.signingIn') : t('login.signIn')}
      </button>
    </form>
  );
};

/**
 * SAML SSO 登录区域组件的属性接口
 */
interface SamlLoginSectionProps {
  /** 是否正在加载 SAML 状态 */
  isLoadingSaml: boolean;
  /** SAML 配置状态 */
  samlStatus: SamlStatus;
  /** SAML 登录回调 */
  onSamlLogin: () => void;
}

/**
 * SAML SSO 登录区域组件
 *
 * 仅在 SAML 已启用且配置完成时显示。
 * 显示"或"分隔线和 SSO 登录按钮。
 */
const SamlLoginSection: React.FC<SamlLoginSectionProps> = ({
  isLoadingSaml,
  samlStatus,
  onSamlLogin
}) => {
  const { t } = useTranslation();

  // 如果正在加载 SAML 状态，或 SAML 未启用/未配置，不显示任何内容
  if (isLoadingSaml || !samlStatus.enabled || !samlStatus.configured) {
    return null;
  }

  return (
    <>
      {/* 分隔线：显示"或"文本 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-muted-foreground">{t('auth.or')}</span>
        </div>
      </div>

      {/* SSO 登录按钮 */}
      <button
        type="button"
        onClick={onSamlLogin}
        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-md border border-gray-300 dark:border-gray-600 transition-colors duration-200"
      >
        <LogIn className="w-4 h-4" />
        {t('auth.ssoSignIn')}
      </button>
    </>
  );
};

/**
 * 登录页面底部区域组件的属性接口
 */
interface LoginFooterProps {
  /** 首次设置回调函数 */
  onFirstTimeSetup: () => void;
}

/**
 * 登录页面底部区域组件
 *
 * 显示首次设置提示和链接，用于初始化系统。
 */
const LoginFooter: React.FC<LoginFooterProps> = ({ onFirstTimeSetup }) => {
  const { t } = useTranslation();

  return (
    <div className="text-center space-y-2">
      {/* 提示文本 */}
      <p className="text-sm text-muted-foreground">
        {t('login.credentials')}
      </p>
      {/* 首次设置链接按钮 */}
      <button
        type="button"
        onClick={onFirstTimeSetup}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 mx-auto"
      >
        <UserPlus className="w-3 h-3" />
        {t('login.firstTime')}
      </button>
    </div>
  );
};

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
 * 管理登录表单状态、SAML 状态检查和用户交互。
 */
const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // 表单状态：用户名
  const [username, setUsername] = useState('');
  // 表单状态：密码
  const [password, setPassword] = useState('');
  // 表单状态：加载中标志
  const [isLoading, setIsLoading] = useState(false);
  // 表单状态：错误消息
  const [error, setError] = useState('');
  // SAML 状态：是否启用和配置
  const [samlStatus, setSamlStatus] = useState<SamlStatus>({ enabled: false, configured: false });
  // SAML 状态：是否正在加载
  const [isLoadingSaml, setIsLoadingSaml] = useState(true);

  // 从认证上下文获取登录方法
  const { login } = useAuth();

  /**
   * 组件挂载时检查 SAML 配置状态
   */
  useEffect(() => {
    const checkSamlStatus = async () => {
      try {
        // 请求后端获取 SAML 配置状态
        const response = await fetch(SAML_STATUS_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          setSamlStatus(data);
        }
      } finally {
        // 无论请求成功与否，都结束加载状态
        setIsLoadingSaml(false);
      }
    };

    checkSamlStatus();
  }, []);

  /**
   * SAML 登录按钮点击处理器
   */
  const onSamlLogin = () => {
    handleSamlLogin(setError, t);
  };

  /**
   * 表单提交处理器
   */
  const onSubmitForm = (e: React.FormEvent) => {
    handleSubmit(username, password, setIsLoading, setError, login, navigate, t, e);
  };

  // 导航到首次设置页面的处理函数
  const handleFirstTimeSetup = () => {
    navigate('/register');
  };

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

          {/* 登录表单字段 */}
          <LoginFormFields
            username={username}
            password={password}
            isLoading={isLoading}
            error={error}
            setUsername={setUsername}
            setPassword={setPassword}
            onSubmit={onSubmitForm}
          />

          {/* SAML SSO 登录区域（条件渲染） */}
          <SamlLoginSection
            isLoadingSaml={isLoadingSaml}
            samlStatus={samlStatus}
            onSamlLogin={onSamlLogin}
          />

          {/* 底部：首次设置链接 */}
          <LoginFooter onFirstTimeSetup={handleFirstTimeSetup} />
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
