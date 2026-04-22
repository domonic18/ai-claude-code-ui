/**
 * 认证操作模块
 *
 * 处理认证相关的 API 调用：登录、注册、登出、密码管理和用户资料操作。
 *
 * @module features/auth/services/authOperations
 */

// 国际化翻译工具
import { t as translate } from '@/shared/i18n';
// 类型定义
import type {
  User,
  LoginCredentials,
  RegistrationData,
  AuthResponse,
} from '../types';
// 日志记录工具
import { logger } from '@/shared/utils/logger';

// 常量定义：API 端点路径
const API_ENDPOINTS = {
  LOGIN: '/login',
  REGISTER: '/register',
  LOGOUT: '/logout',
  ME: '/me',
  VALIDATE: '/validate'
} as const;

// 常量定义：HTTP 方法
const HTTP_METHODS = {
  POST: 'POST',
  GET: 'GET',
  PATCH: 'PATCH'
} as const;

/**
 * 执行登录操作
 *
 * 发送用户凭据到后端进行认证，成功后存储会话信息。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {LoginCredentials} credentials - 用户凭据（用户名和密码）
 * @param {Function} storeSession - 会话存储函数
 * @returns {Promise<AuthResponse>} 登录响应，包含用户信息、token 或错误消息
 */
export async function executeLogin(
  baseUrl: string,
  credentials: LoginCredentials,
  storeSession: (session: any) => void
): Promise<AuthResponse> {
  try {
    // 发送登录请求到后端 API
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.LOGIN}`, {
      method: HTTP_METHODS.POST,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    // 检查响应是否成功
    if (!response.ok) {
      // 尝试解析错误消息
      const error = await response.json().catch(() => ({ message: translate('auth.error.loginFailed') }));
      return {
        success: false,
        error: error.message || translate('auth.error.loginFailed'),
      };
    }

    // 解析响应数据
    const data = await response.json();
    const authResponse: AuthResponse = {
      success: true,
      user: data.user,
      token: data.token,
      message: data.message,
    };

    // 如果登录成功，将会话信息存储到本地
    if (authResponse.token) {
      storeSession({
        token: authResponse.token,
        user: authResponse.user,
        isAuthenticated: true,
      });
    }

    return authResponse;
  } catch (error) {
    // 记录错误日志
    logger.error('Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : translate('auth.error.networkError'),
    };
  }
}

// 常量定义：默认错误消息
const DEFAULT_ERROR_MESSAGES = {
  LOGIN_FAILED: 'auth.error.loginFailed',
  REGISTRATION_FAILED: 'auth.error.registrationFailed',
  NETWORK_ERROR: 'auth.error.networkError'
} as const;

/**
 * 执行注册操作
 *
 * 发送用户注册信息到后端，成功后自动登录并存储会话。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {RegistrationData} data - 注册数据（用户名和密码）
 * @param {Function} storeSession - 会话存储函数
 * @returns {Promise<AuthResponse>} 注册响应，包含用户信息、token 或错误消息
 */
export async function executeRegister(
  baseUrl: string,
  data: RegistrationData,
  storeSession: (session: any) => void
): Promise<AuthResponse> {
  try {
    // 发送注册请求到后端 API
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.REGISTER}`, {
      method: HTTP_METHODS.POST,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    // 检查响应是否成功
    if (!response.ok) {
      // 尝试解析错误消息
      const error = await response.json().catch(() => ({ message: translate(DEFAULT_ERROR_MESSAGES.REGISTRATION_FAILED) }));
      return {
        success: false,
        error: error.message || translate(DEFAULT_ERROR_MESSAGES.REGISTRATION_FAILED),
      };
    }

    // 解析响应数据
    const responseData = await response.json();
    const authResponse: AuthResponse = {
      success: true,
      user: responseData.user,
      token: responseData.token,
      message: responseData.message,
    };

    // 如果注册成功，将会话信息存储到本地（自动登录）
    if (authResponse.token) {
      storeSession({
        token: authResponse.token,
        user: authResponse.user,
        isAuthenticated: true,
      });
    }

    return authResponse;
  } catch (error) {
    // 记录错误日志
    logger.error('Registration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : translate(DEFAULT_ERROR_MESSAGES.NETWORK_ERROR),
    };
  }
}

/**
 * 执行登出操作
 *
 * 通知后端登出用户，并清除本地会话信息。
 * 即使后端请求失败，也会清除本地会话。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {Function} clearSession - 清除会话的函数
 * @returns {Promise<void>}
 */
export async function executeLogout(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void
): Promise<void> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    if (token) {
      // 通知后端登出
      await fetch(`${baseUrl}${API_ENDPOINTS.LOGOUT}`, {
        method: HTTP_METHODS.POST,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    // 记录错误日志，但不影响后续的会话清除
    logger.error('Logout error:', error);
  } finally {
    // 无论 API 调用是否成功，都清除本地会话
    clearSession();
  }
}

// 重新导出密码操作函数（从 authPasswordOperations 模块）
export {
  changePassword,
  requestPasswordReset,
  confirmPasswordReset,
} from './authPasswordOperations';

/**
 * 从服务器刷新用户数据
 *
 * 获取最新的用户信息并更新本地会话。
 * 如果 token 已过期或无效，则清除会话。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {Function} clearSession - 清除会话的函数
 * @param {Function} updateSessionUser - 更新会话中用户信息的函数
 * @returns {Promise<User | null>} 更新后的用户对象，失败返回 null
 */
export async function refreshUser(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void,
  updateSessionUser: (user: User) => void
): Promise<User | null> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    if (!token) {
      return null;
    }

    // 请求后端获取最新用户信息
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.ME}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // 检查响应是否成功
    if (!response.ok) {
      // token 可能已过期，清除本地会话
      clearSession();
      return null;
    }

    // 解析用户数据
    const user = await response.json();
    // 更新本地会话中的用户信息
    updateSessionUser(user);

    return user;
  } catch (error) {
    // 记录错误日志
    logger.error('Refresh user error:', error);
    return null;
  }
}

/**
 * 更新用户资料
 *
 * 向后端发送用户资料更新请求，成功后更新本地会话。
 * 支持部分更新（只修改提供的字段）。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {Function} updateSessionUser - 更新会话中用户信息的函数
 * @param {Partial<User>} updates - 要更新的用户字段（部分更新）
 * @returns {Promise<User | null>} 更新后的用户对象，失败返回 null
 */
export async function updateUser(
  baseUrl: string,
  getToken: () => string | null,
  updateSessionUser: (user: User) => void,
  updates: Partial<User>
): Promise<User | null> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // 发送 PATCH 请求更新用户资料
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.ME}`, {
      method: HTTP_METHODS.PATCH,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    // 检查响应是否成功
    if (!response.ok) {
      throw new Error('Failed to update user');
    }

    // 解析更新后的用户数据
    const updatedUser = await response.json();
    // 更新本地会话中的用户信息
    updateSessionUser(updatedUser);

    return updatedUser;
  } catch (error) {
    // 记录错误日志
    logger.error('Update user error:', error);
    return null;
  }
}

/**
 * 向服务器验证 token 有效性
 *
 * 检查当前用户的认证 token 是否仍然有效。
 * 如果 token 无效或过期，则清除本地会话。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {Function} clearSession - 清除会话的函数
 * @returns {Promise<boolean>} token 是否有效
 */
export async function validateToken(
  baseUrl: string,
  getToken: () => string | null,
  clearSession: () => void
): Promise<boolean> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    if (!token) {
      return false;
    }

    // 向后端发送 token 验证请求
    const response = await fetch(`${baseUrl}${API_ENDPOINTS.VALIDATE}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // 检查响应是否成功
    if (!response.ok) {
      // token 无效或已过期，清除本地会话
      clearSession();
      return false;
    }

    // token 有效
    return true;
  } catch {
    // 发生异常，清除本地会话
    clearSession();
    return false;
  }
}
