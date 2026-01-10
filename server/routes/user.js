import express from 'express';
import { userDb } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getSystemGitConfig } from '../utils/gitConfig.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

router.get('/git-config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let gitConfig = userDb.getGitConfig(userId);

    // 如果数据库为空，尝试从系统 git 配置获取
    if (!gitConfig || (!gitConfig.git_name && !gitConfig.git_email)) {
      const systemConfig = await getSystemGitConfig();

      // 如果系统有值，则将其保存到数据库中供此用户使用
      if (systemConfig.git_name || systemConfig.git_email) {
        userDb.updateGitConfig(userId, systemConfig.git_name, systemConfig.git_email);
        gitConfig = systemConfig;
        console.log(`Auto-populated git config from system for user ${userId}: ${systemConfig.git_name} <${systemConfig.git_email}>`);
      }
    }

    res.json({
      success: true,
      gitName: gitConfig?.git_name || null,
      gitEmail: gitConfig?.git_email || null
    });
  } catch (error) {
    console.error('Error getting git config:', error);
    res.status(500).json({ error: 'Failed to get git configuration' });
  }
});

// 通过 git config --global 全局应用 git 配置
router.post('/git-config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gitName, gitEmail } = req.body;

    if (!gitName || !gitEmail) {
      return res.status(400).json({ error: 'Git name and email are required' });
    }

    // 验证电子邮件格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(gitEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    userDb.updateGitConfig(userId, gitName, gitEmail);

    try {
      await execAsync(`git config --global user.name "${gitName.replace(/"/g, '\\"')}"`);
      await execAsync(`git config --global user.email "${gitEmail.replace(/"/g, '\\"')}"`);
      console.log(`Applied git config globally: ${gitName} <${gitEmail}>`);
    } catch (gitError) {
      console.error('Error applying git config:', gitError);
    }

    res.json({
      success: true,
      gitName,
      gitEmail
    });
  } catch (error) {
    console.error('Error updating git config:', error);
    res.status(500).json({ error: 'Failed to update git configuration' });
  }
});

router.post('/complete-onboarding', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    userDb.completeOnboarding(userId);

    res.json({
      success: true,
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

router.get('/onboarding-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const hasCompleted = userDb.hasCompletedOnboarding(userId);

    res.json({
      success: true,
      hasCompletedOnboarding: hasCompleted
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    res.status(500).json({ error: 'Failed to check onboarding status' });
  }
});

export default router;
