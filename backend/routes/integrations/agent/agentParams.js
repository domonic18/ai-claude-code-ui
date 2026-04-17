/**
 * agentParams.js
 *
 * Agent API 参数校验与归一化工具
 *
 * @module routes/integrations/agent/agentParams
 */

import path from 'path';
import os from 'os';

const ALLOWED_GIT_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org'];
const VALID_PROVIDERS = ['claude', 'cursor', 'codex'];

/**
 * 将各种形式的布尔参数归一化为 true/false
 * @param {*} value - 原始参数值
 * @param {boolean} defaultVal - 默认值
 * @returns {boolean} 归一化后的布尔值
 */
export function normalizeBoolean(value, defaultVal = false) {
    if (value === undefined) return defaultVal;
    return value === true || value === 'true';
}

/**
 * 校验并归一化 agent 请求参数
 * @param {Object} body - 请求体
 * @returns {Object} 归一化后的参数对象
 */
export function normalizeAgentParams(body) {
    const { githubUrl, projectPath, message, provider = 'claude', model, githubToken, branchName } = body;
    return {
        githubUrl, projectPath, message, provider, model, githubToken, branchName,
        stream: normalizeBoolean(body.stream, true),
        cleanup: normalizeBoolean(body.cleanup, true),
        createBranch: branchName ? true : normalizeBoolean(body.createBranch, false),
        createPR: normalizeBoolean(body.createPR, false),
    };
}

/**
 * 校验 agent 请求参数，返回错误信息或 null
 * @param {Object} params - 归一化后的参数
 * @returns {string|null} 错误信息，校验通过返回 null
 */
export function validateAgentParams(params) {
    if (!params.githubUrl && !params.projectPath) {
        return 'Either githubUrl or projectPath is required';
    }
    if (!params.message || !params.message.trim()) {
        return 'message is required';
    }
    if (!VALID_PROVIDERS.includes(params.provider)) {
        return 'provider must be "claude", "cursor", or "codex"';
    }
    if (params.githubUrl) {
        const urlError = validateGithubUrl(params.githubUrl);
        if (urlError) return urlError;
    }
    if ((params.createBranch || params.createPR) && !params.githubUrl && !params.projectPath) {
        return 'createBranch and createPR require either githubUrl or projectPath with a GitHub remote';
    }
    return null;
}

/**
 * 校验 projectPath 安全性
 * @param {string} projectPath - 项目路径
 * @returns {string|null} 错误信息，校验通过返回 null
 */
export function validateProjectPath(projectPath) {
    const resolved = path.resolve(projectPath);
    const externalProjectsDir = path.join(os.homedir(), '.claude', 'external-projects');
    if (!resolved.startsWith(os.homedir()) && !resolved.startsWith(externalProjectsDir)) {
        return 'projectPath must be within the user home directory';
    }
    if (resolved.includes('..')) {
        return 'projectPath cannot contain path traversal sequences';
    }
    return null;
}

/**
 * 校验 GitHub URL 合法性
 * @param {string} githubUrl - GitHub URL
 * @returns {string|null} 错误信息，校验通过返回 null
 */
function validateGithubUrl(githubUrl) {
    try {
        const parsed = new URL(githubUrl.trim());
        if (!['https:', 'http:'].includes(parsed.protocol)) {
            return 'githubUrl must use http or https protocol';
        }
        if (!ALLOWED_GIT_HOSTS.includes(parsed.hostname.toLowerCase())) {
            return `githubUrl host must be one of: ${ALLOWED_GIT_HOSTS.join(', ')}`;
        }
    } catch {
        return 'githubUrl is not a valid URL';
    }
    return null;
}
