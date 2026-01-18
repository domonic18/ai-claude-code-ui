/**
 * Extensions API Routes
 *
 * Provides endpoints for managing pre-configured extensions
 * (agents, commands, skills) synchronization.
 *
 * @module routes/api/extensions
 */

import express from 'express';
import { syncExtensions, syncToAllUsers, getAllExtensions } from '../../services/extensions/extension-sync.js';
import { authenticateToken } from '../../middleware/auth.js';
import { getWorkspaceDir } from '../../config/config.js';

const router = express.Router();

/**
 * GET /api/extensions
 *
 * Get all available pre-configured extensions
 *
 * Authentication required
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const extensions = await getAllExtensions();
    res.json({
      success: true,
      data: extensions
    });
  } catch (error) {
    console.error('[Extensions API] Failed to get extensions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/extensions/sync-all
 *
 * Synchronize extensions to all users
 *
 * Authentication required
 * Body: { overwriteUserFiles?: boolean }
 */
router.post('/sync-all', authenticateToken, async (req, res) => {
  try {
    const { overwriteUserFiles = false } = req.body;
    const results = await syncToAllUsers({ overwriteUserFiles });

    console.log(`[Extensions API] Synced to ${results.synced}/${results.total} users, ${results.failed} failed`);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[Extensions API] Failed to sync to all users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/extensions/sync-user
 *
 * Synchronize extensions to a specific user
 *
 * Authentication required
 * Body: { userId: number, overwriteUserFiles?: boolean }
 */
router.post('/sync-user', authenticateToken, async (req, res) => {
  try {
    const { userId, overwriteUserFiles = false } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const workspaceDir = getWorkspaceDir();
    const claudeDir = `${workspaceDir}/users/user_${userId}/data/.claude`;

    const results = await syncExtensions(claudeDir, { overwriteUserFiles });

    console.log(`[Extensions API] Synced extensions for user ${userId}`);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[Extensions API] Failed to sync to user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
