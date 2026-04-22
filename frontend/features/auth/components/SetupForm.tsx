// React 核心库导入
import React, { useState } from 'react';
// React Router 导航钩子
import { useNavigate } from 'react-router-dom';
// 国际化翻译钩子
import { useTranslation } from 'react-i18next';
// 认证上下文钩子
import { useAuth } from '@/shared/contexts/AuthContext';
// 注册表单布局组件
import { SetupFormLayout } from './SetupFormLayout';

// 常量定义：表单验证规则
const VALIDATION_RULES = {
  MIN_USERNAME_LENGTH: 3,  // 用户名最小长度
  MIN_PASSWORD_LENGTH: 6   // 密码最小长度
};

/**
 * 注册表单字段组件的属性接口
 */
export interface RegistrationFormFieldsProps {
  /** 用户名输入值 */
  username: string;
  /** 密码输入值 */
  password: string;
  /** 确认密码输入值 */
  confirmPassword: string;
  /** 是否处于加载状态 */
  isLoading: boolean;
  /** 用户名变更回调 */
  onUsernameChange: (value: string) => void;
  /** 密码变更回调 */
  onPasswordChange: (value: string) => void;
  /** 确认密码变更回调 */
  onConfirmPasswordChange: (value: string) => void;
  /** 国际化翻译函数 */
  t: (key: string) => string;
}

/**
 * 注册表单字段组件
 *
 * 渲染用户名、密码和确认密码三个输入字段。
 * 字段带有适当的标签、占位符和自动完成属性。
 */
export function RegistrationFormFields({
  username,
  password,
  confirmPassword,
  isLoading,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  t,
}: RegistrationFormFieldsProps) {
  return (
    <>
      {/* 用户名输入字段 */}
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
          {t('login.username')}
        </label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
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
          {t('register.password')}
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('register.passwordPlaceholder')}
          autoComplete="new-password"
          required
          disabled={isLoading}
        />
      </div>

      {/* 确认密码输入字段 */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
          {t('register.confirmPassword')}
        </label>
        <input
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('register.confirmPasswordPlaceholder')}
          autoComplete="new-password"
          required
          disabled={isLoading}
        />
      </div>
    </>
  );
}

// 常量定义：错误消息键名
const ERROR_KEYS = {
  PASSWORD_MISMATCH: 'register.passwordMismatch',
  USERNAME_TOO_SHORT: 'register.usernameTooShort',
  PASSWORD_TOO_SHORT: 'register.passwordTooShort'
};

/**
 * 验证注册表单数据
 *
 * 检查密码是否匹配、用户名长度、密码长度等验证规则。
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} confirmPassword - 确认密码
 * @param {Function} t - 国际化翻译函数
 * @returns {string | null} 验证错误消息，验证通过返回 null
 */
function validateRegistrationForm(
  username: string,
  password: string,
  confirmPassword: string,
  t: (key: string) => string
): string | null {
  // 检查两次输入的密码是否一致
  if (password !== confirmPassword) {
    return t('register.passwordMismatch');
  }

  // 验证用户名长度至少为 3 个字符
  if (username.length < 3) {
    return t('register.usernameTooShort');
  }

  // 验证密码长度至少为 6 个字符
  if (password.length < 6) {
    return t('register.passwordTooShort');
  }

  // 所有验证通过
  return null;
}

/**
 * SetupForm 主组件
 *
 * 处理初始用户注册的完整流程，包括表单状态管理、验证和提交。
 * 注册成功后自动跳转到聊天页面。
 */
const SetupForm: React.FC = () => {
  // 国际化翻译钩子
  const { t } = useTranslation();
  // 路由导航钩子
  const navigate = useNavigate();

  // 表单状态：用户名
  const [username, setUsername] = useState('');
  // 表单状态：密码
  const [password, setPassword] = useState('');
  // 表单状态：确认密码
  const [confirmPassword, setConfirmPassword] = useState('');
  // 表单状态：加载中标志
  const [isLoading, setIsLoading] = useState(false);
  // 表单状态：错误消息
  const [error, setError] = useState('');

  // 从认证上下文获取注册方法
  const { register } = useAuth();

  // 用户名输入变更处理函数
  const handleUsernameChange = (value: string) => {
    setUsername(value);
  };

  // 密码输入变更处理函数
  const handlePasswordChange = (value: string) => {
    setPassword(value);
  };

  // 确认密码输入变更处理函数
  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
  };

  // 返回登录页面处理函数
  const handleBackToLogin = () => {
    navigate('/login');
  };

  /**
   * 处理表单提交事件
   * 执行客户端验证，然后调用注册 API
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // 阻止表单默认提交行为
    e.preventDefault();
    // 清空之前的错误消息
    setError('');

    // 执行表单验证
    const validationError = validateRegistrationForm(username, password, confirmPassword, t);
    if (validationError) {
      // 验证失败，显示错误消息
      setError(validationError);
      return;
    }

    // 进入加载状态
    setIsLoading(true);

    // 调用注册 API
    const result = await register(username, password);

    if (result.success) {
      // 注册成功：跳转到聊天页面
      navigate('/chat');
    } else {
      // 注册失败：显示错误消息并退出加载状态
      setError(result.error || t('register.failed'));
      setIsLoading(false);
    }
  };

  return (
    <SetupFormLayout
      username={username}
      password={password}
      confirmPassword={confirmPassword}
      isLoading={isLoading}
      error={error}
      onUsernameChange={handleUsernameChange}
      onPasswordChange={handlePasswordChange}
      onConfirmPasswordChange={handleConfirmPasswordChange}
      onSubmit={handleSubmit}
      onBackToLogin={handleBackToLogin}
      t={t}
    />
  );
};

export default SetupForm;
