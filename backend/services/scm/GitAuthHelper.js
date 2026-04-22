/**
 * Git 认证辅助模块
 *
 * 负责 git 操作中的认证凭证管理：
 * - 创建临时 askpass 脚本用于安全传递 token
 * - 清理临时认证文件
 *
 * @module services/scm/GitAuthHelper
 */

import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/scm/GitAuthHelper');

const ASKPASS_DIR = path.join(os.tmpdir(), 'claude-ui-askpass');
const ASKPASS_SCRIPT = '#!/bin/sh\nprintf \'%s\\n\' "$GIT_ASKPASS_SECRET"\n';

// GitAuthHelper.js 功能函数
/**
 * 创建临时 askpass 脚本用于安全传递 GitHub token
 *
 * 通过环境变量传递 token，避免在 ps 进程列表中暴露凭证。
 *
 * @param {string} githubToken - GitHub 个人访问令牌
 * @returns {Promise<{askpassPath: string, env: Object}>} askpass 路径和环境变量
 */
export async function createAskpassScript(githubToken) {
  await fs.mkdir(ASKPASS_DIR, { recursive: true });
  const askpassPath = path.join(ASKPASS_DIR, `askpass-${Date.now()}.sh`);
  await fs.writeFile(askpassPath, ASKPASS_SCRIPT, { mode: 0o700 });

  const env = {
    GIT_ASKPASS: askpassPath,
    GIT_ASKPASS_SECRET: githubToken,
    GIT_TERMINAL_PROMPT: '0',
  };

  return { askpassPath, env };
}

// GitAuthHelper.js 功能函数
/**
 * 清理 askpass 脚本文件
 * @param {string} askpassPath - 要删除的 askpass 脚本路径
 */
export async function cleanupAskpass(askpassPath) {
  await fs.unlink(askpassPath).catch(() => {});
}

// GitAuthHelper.js 功能函数
/**
 * 构建克隆操作的 git 环境变量
 * @param {string|null} githubToken - GitHub token（可选）
 * @returns {Promise<{env: Object, cleanup: Function}>} 环境变量和清理函数
 */
export async function buildCloneAuth(githubToken) {
  if (!githubToken) {
    return { env: {}, cleanup: async () => {} };
  }

  const { askpassPath, env } = await createAskpassScript(githubToken);
  return {
    env,
    cleanup: async () => {
      await cleanupAskpass(askpassPath);
    },
  };
}
