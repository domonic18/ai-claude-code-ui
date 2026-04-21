/**
 * 用户设置路由
 *
 * 提供用户级别的设置管理端点，包括 Git 配置的读写和引导流程状态管理。
 * 所有端点需要 JWT 认证。
 *
 * ## 端点列表
 * - GET  /git-config           — 获取用户的 Git 配置（自动从系统 git 配置填充）
 * - POST /git-config           — 更新用户的 Git 配置并应用到系统全局
 * - POST /complete-onboarding  — 标记用户引导流程完成
 * - GET  /onboarding-status    — 查询用户引导流程状态
 *
 * @module routes/core/users
 */

import express from 'express';
import { repositories } from '../../database/db.js';
import { authenticateToken } from '../../middleware/auth.js';
import { getSystemGitConfig } from '../../utils/gitConfig.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../../utils/logger.js';
const logger = createLogger('routes/core/users');

const { User } = repositories;

const execAsync = promisify(exec);
const router = express.Router();

/**
 * GET /git-config
 *
 * 获取用户的 Git 配置。若数据库中无记录，则尝试从系统 git 全局配置读取
 * 并自动保存到数据库中。
 *
 * @route GET /git-config
 * @auth 需要JWT认证
 * @returns {{success: boolean, data: {gitName: string|null, gitEmail: string|null}}}
 */
router.get('/git-config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    let gitConfig = User.getGitConfig(userId);

    // 如果数据库为空，尝试从系统 git 配置获取
    if (!gitConfig || (!gitConfig.git_name && !gitConfig.git_email)) {
      const systemConfig = await getSystemGitConfig();

      // 如果系统有值，则将其保存到数据库中供此用户使用
      if (systemConfig.git_name || systemConfig.git_email) {
        User.updateGitConfig(userId, systemConfig.git_name, systemConfig.git_email);
        gitConfig = systemConfig;
        logger.info(`Auto-populated git config from system for user ${userId}: ${systemConfig.git_name} <${systemConfig.git_email}>`);
      }
    }

    res.json({
      success: true,
      data: {
        gitName: gitConfig?.git_name || null,
        gitEmail: gitConfig?.git_email || null
      }
    });
  } catch (error) {
    logger.error('Error getting git config:', error);
    res.status(500).json({ error: 'Failed to get git configuration' });
  }
});

/**
 * POST /git-config
 *
 * 更新用户的 Git 配置。同时保存到数据库并通过 `git config --global`
 * 写入系统全局配置，确保所有 CLI 工具使用一致的提交者信息。
 *
 * @route POST /git-config
 * @auth 需要JWT认证
 * @body {string} gitName - Git 用户名
 * @body {string} gitEmail - Git 邮箱地址
 * @returns {{success: boolean, data: {gitName: string, gitEmail: string}}}
 */
router.post('/git-config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { gitName, gitEmail } = req.body;

    if (!gitName || !gitEmail) {
      return res.status(400).json({ error: 'Git name and email are required' });
    }

    // 验证电子邮件格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(gitEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // 保存到数据库
    User.updateGitConfig(userId, gitName, gitEmail);

    // 同步到系统全局 git 配置（即使失败也不阻塞响应）
    try {
      await execAsync(`git config --global user.name "${gitName.replace(/"/g, '\\"')}"`);
      await execAsync(`git config --global user.email "${gitEmail.replace(/"/g, '\\"')}"`);
      logger.info(`Applied git config globally: ${gitName} <${gitEmail}>`);
    } catch (gitError) {
      logger.error('Error applying git config:', gitError);
    }

    res.json({
      success: true,
      data: {
        gitName,
        gitEmail
      }
    });
  } catch (error) {
    logger.error('Error updating git config:', error);
    res.status(500).json({ error: 'Failed to update git configuration' });
  }
});

/**
 * POST /complete-onboarding
 *
 * 标记用户已完成引导流程。前端调用后不再显示引导界面。
 *
 * @route POST /complete-onboarding
 * @auth 需要JWT认证
 * @returns {{success: boolean, data: {message: string}}}
 */
router.post('/complete-onboarding', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    User.completeOnboarding(userId);

    res.json({
      success: true,
      data: {
        message: 'Onboarding completed successfully'
      }
    });
  } catch (error) {
    logger.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

/**
 * GET /onboarding-status
 *
 * 查询用户是否已完成引导流程。
 *
 * @route GET /onboarding-status
 * @auth 需要JWT认证
 * @returns {{success: boolean, data: {hasCompletedOnboarding: boolean}}}
 */
router.get('/onboarding-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const hasCompleted = User.hasCompletedOnboarding(userId);

    res.json({
      success: true,
      data: {
        hasCompletedOnboarding: hasCompleted
      }
    });
  } catch (error) {
    logger.error('Error checking onboarding status:', error);
    res.status(500).json({ error: 'Failed to check onboarding status' });
  }
});

export default router;
