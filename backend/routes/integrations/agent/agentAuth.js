/**
 * agentAuth.js
 *
 * Agent API 认证中间件
 * 支持平台模式（外部代理认证）和 API Key 模式（自托管）
 *
 * @module routes/integrations/agent/agentAuth
 */

import { repositories } from '../../../database/db.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('routes/integrations/agent/auth');
const { User, ApiKey } = repositories;

/**
 * 验证代理 API 请求的中间件。
 * 支持平台模式（外部代理认证）和 API Key 模式（自托管）。
 */
export function validateExternalApiKey(req, res, next) {
    if (process.env.VITE_IS_PLATFORM === 'true') {
        return handlePlatformMode(req, res, next);
    }
    return handleApiKeyMode(req, res, next);
}

/**
 * 平台模式认证处理
 */
function handlePlatformMode(req, res, next) {
    try {
        const user = User.getFirst();
        if (!user) {
            return res.status(500).json({ error: 'Platform mode: No user found in database' });
        }
        req.user = user;
        return next();
    } catch (error) {
        logger.error({ error: error.message }, 'Platform mode error');
        return res.status(500).json({ error: 'Platform mode: Failed to fetch user' });
    }
}

/**
 * API Key 模式认证处理
 */
function handleApiKeyMode(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    const user = ApiKey.validate(apiKey);
    if (!user) {
        return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    req.user = user;
    next();
}
