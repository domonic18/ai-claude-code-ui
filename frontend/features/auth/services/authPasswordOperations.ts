/**
 * 密码操作模块
 *
 * 处理密码重置和修改相关的 API 调用。
 *
 * @module features/auth/services/authPasswordOperations
 */

// 国际化翻译工具
import { t as translate } from '@/shared/i18n';
// 日志记录工具
import { logger } from '@/shared/utils/logger';

// 常量定义：密码操作 API 端点
const PASSWORD_API_ENDPOINTS = {
  CHANGE_PASSWORD: '/change-password',
  REQUEST_RESET: '/reset-password/request',
  CONFIRM_RESET: '/reset-password/confirm'
} as const;

/**
 * 修改用户密码
 *
 * 向后端发送密码修改请求，需要提供当前密码和新密码。
 * 用户必须已认证（持有有效 token）。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {Function} getToken - 获取认证 token 的函数
 * @param {string} oldPassword - 当前密码
 * @param {string} newPassword - 新密码
 * @returns {Promise<boolean>} 是否修改成功
 */
export async function changePassword(
  baseUrl: string,
  getToken: () => string | null,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  try {
    // 获取当前用户的认证 token
    const token = getToken();
    // 如果没有 token，说明用户未认证，返回失败
    if (!token) {
      return false;
    }

    // 发送密码修改请求到后端 API
    const response = await fetch(`${baseUrl}${PASSWORD_API_ENDPOINTS.CHANGE_PASSWORD}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    // 返回请求是否成功（HTTP 状态码 2xx）
    return response.ok;
  } catch (error) {
    // 记录错误日志
    logger.error('Change password error:', error);
    // 发生异常时返回失败
    return false;
  }
}

/**
 * 请求密码重置
 *
 * 发送密码重置请求到用户的邮箱。后端会发送包含重置令牌的邮件。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {string} email - 用户邮箱地址
 * @returns {Promise<boolean>} 是否请求成功
 */
export async function requestPasswordReset(
  baseUrl: string,
  email: string
): Promise<boolean> {
  try {
    // 发送密码重置请求到后端 API
    const response = await fetch(`${baseUrl}${PASSWORD_API_ENDPOINTS.REQUEST_RESET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    // 返回请求是否成功
    return response.ok;
  } catch (error) {
    // 记录错误日志
    logger.error('Request password reset error:', error);
    // 发生异常时返回失败
    return false;
  }
}

/**
 * 确认密码重置
 *
 * 使用从邮件中获取的重置令牌来设置新密码。
 * 令牌通常有时效性且只能使用一次。
 *
 * @param {string} baseUrl - 基础 API URL
 * @param {string} token - 密码重置令牌（从邮件链接中获取）
 * @param {string} newPassword - 新密码
 * @returns {Promise<boolean>} 是否重置成功
 */
export async function confirmPasswordReset(
  baseUrl: string,
  token: string,
  newPassword: string
): Promise<boolean> {
  try {
    // 使用重置令牌和新密码调用后端 API
    const response = await fetch(`${baseUrl}${PASSWORD_API_ENDPOINTS.CONFIRM_RESET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });

    // 返回请求是否成功
    return response.ok;
  } catch (error) {
    // 记录错误日志
    logger.error('Confirm password reset error:', error);
    // 发生异常时返回失败
    return false;
  }
}
