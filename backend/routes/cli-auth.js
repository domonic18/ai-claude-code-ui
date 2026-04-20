import express from 'express';
import { createLogger } from '../utils/logger.js';
import {
  checkClaudeCredentials,
  checkCursorStatus,
  checkCodexCredentials
} from './cliAuthHelpers.js';

const logger = createLogger('routes/cli-auth');

const router = express.Router();

router.get('/claude/status', async (req, res) => {
  try {
    const credentialsResult = await checkClaudeCredentials();

    if (credentialsResult.authenticated) {
      return res.json({
        authenticated: true,
        email: credentialsResult.email || 'Authenticated',
        method: 'credentials_file'
      });
    }

    return res.json({
      authenticated: false,
      email: null,
      error: credentialsResult.error || 'Not authenticated'
    });

  } catch (error) {
    logger.error('Error checking Claude auth status:', error);
    res.status(500).json({
      authenticated: false,
      email: null,
      error: error.message
    });
  }
});

router.get('/cursor/status', async (req, res) => {
  try {
    const result = await checkCursorStatus();

    res.json({
      authenticated: result.authenticated,
      email: result.email,
      error: result.error
    });

  } catch (error) {
    logger.error('Error checking Cursor auth status:', error);
    res.status(500).json({
      authenticated: false,
      email: null,
      error: error.message
    });
  }
});

router.get('/codex/status', async (req, res) => {
  try {
    const result = await checkCodexCredentials();

    res.json({
      authenticated: result.authenticated,
      email: result.email,
      error: result.error
    });

  } catch (error) {
    logger.error('Error checking Codex auth status:', error);
    res.status(500).json({
      authenticated: false,
      email: null,
      error: error.message
    });
  }
});

export default router;
