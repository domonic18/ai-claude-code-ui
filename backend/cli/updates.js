/**
 * CLI Update Functions
 *
 * 提供软件更新检查和更新功能
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { c } from '../config/config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('cli-updates');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 package.json 以获取版本信息
const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

/**
 * 比较语义化版本
 * @param {string} v1 - 版本1 (例如 "1.2.3")
 * @param {string} v2 - 版本2 (例如 "1.2.4")
 * @returns {boolean} 如果 v1 > v2 则返回 true
 */
export function isNewerVersion(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (parts1[i] > parts2[i]) return true;
        if (parts1[i] < parts2[i]) return false;
    }
    return false;
}

/**
 * 检查更新
 * @param {boolean} silent - 是否静默模式（不输出信息）
 * @returns {Promise<Object>} 更新信息对象
 */
export async function checkForUpdates(silent = false) {
    try {
        const { execSync } = await import('child_process');
        const latestVersion = execSync('npm show @domonic18/ai-claude-code-ui version', { encoding: 'utf8' }).trim();
        const currentVersion = packageJson.version;

        if (isNewerVersion(latestVersion, currentVersion)) {
            logger.info(`\n${c.warn('[UPDATE]')} New version available: ${c.bright(latestVersion)} (current: ${currentVersion})`);
            logger.info(`         Run ${c.bright('cloudcli update')} to update\n`);
            return { hasUpdate: true, latestVersion, currentVersion };
        } else if (!silent) {
            logger.info(`${c.ok('[OK]')} You are on the latest version (${currentVersion})`);
        }
        return { hasUpdate: false, latestVersion, currentVersion };
    } catch (e) {
        if (!silent) {
            logger.info(`${c.warn('[WARN]')} Could not check for updates`);
        }
        return { hasUpdate: false, error: e.message };
    }
}

/**
 * 更新包到最新版本
 * @returns {Promise<void>}
 */
export async function updatePackage() {
    try {
        const { execSync } = await import('child_process');
        logger.info(`${c.info('[INFO]')} Checking for updates...`);

        const { hasUpdate, latestVersion, currentVersion } = await checkForUpdates(true);

        if (!hasUpdate) {
            logger.info(`${c.ok('[OK]')} Already on the latest version (${currentVersion})`);
            return;
        }

        logger.info(`${c.info('[INFO]')} Updating from ${currentVersion} to ${latestVersion}...`);
        execSync('npm update -g @domonic18/ai-claude-code-ui', { stdio: 'inherit' });
        logger.info(`${c.ok('[OK]')} Update complete! Restart cloudcli to use the new version.`);
    } catch (e) {
        logger.error(`${c.error('[ERROR]')} Update failed: ${e.message}`);
        logger.info(`${c.tip('[TIP]')} Try running manually: npm update -g @domonic18/ai-claude-code-ui`);
    }
}
