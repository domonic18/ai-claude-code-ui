#!/usr/bin/env node
/**
 * Claude Code UI CLI
 *
 * 提供用于管理 Claude Code UI 的命令行工具
 *
 * 命令:
 *   (无参数)      - 启动服务器（默认）
 *   start         - 启动服务器
 *   status        - 显示配置和数据位置
 *   help          - 显示帮助信息
 *   version       - 显示版本信息
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadEnvironment, DATABASE, SERVER, CLAUDE, c } from './config/config.js';
import { createLogger } from './utils/logger.js';
const logger = createLogger('cli');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 package.json 以获取版本信息
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 获取数据库路径（使用统一配置）
// 注意：loadEnvironment() 已在 config.js 模块加载时自动调用
function getDatabasePath() {
    return DATABASE.path;
}

// 获取安装目录
function getInstallDir() {
    return path.join(__dirname, '..');
}

// 显示状态命令
function showStatus() {
    logger.info(`\n${c.bright('Claude Code UI - Status')}\n`);
    logger.info(c.dim('═'.repeat(60)));

    // 版本信息
    logger.info(`\n${c.info('[INFO]')} Version: ${c.bright(packageJson.version)}`);

    // 安装位置
    const installDir = getInstallDir();
    logger.info(`\n${c.info('[INFO]')} Installation Directory:`);
    logger.info(`       ${c.dim(installDir)}`);

    // 数据库位置
    const dbPath = getDatabasePath();
    const dbExists = fs.existsSync(dbPath);
    logger.info(`\n${c.info('[INFO]')} Database Location:`);
    logger.info(`       ${c.dim(dbPath)}`);
    logger.info(`       Status: ${dbExists ? c.ok('[OK] Exists') : c.warn('[WARN] Not created yet (will be created on first run)')}`);

    if (dbExists) {
        const stats = fs.statSync(dbPath);
        logger.info(`       Size: ${c.dim((stats.size / 1024).toFixed(2) + ' KB')}`);
        logger.info(`       Modified: ${c.dim(stats.mtime.toLocaleString())}`);
    }

    // 环境变量
    logger.info(`\n${c.info('[INFO]')} Configuration:`);
    logger.info(`       PORT: ${c.bright(SERVER.port)} ${c.dim(process.env.PORT ? '' : '(default)')}`);
    logger.info(`       DATABASE_PATH: ${c.dim(DATABASE.path)}`);
    logger.info(`       CLAUDE_CLI_PATH: ${c.dim(CLAUDE.cliPath)}`);
    logger.info(`       CONTEXT_WINDOW: ${c.dim(CLAUDE.contextWindow)}`);

    // Claude 项目文件夹
    const claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');
    const projectsExists = fs.existsSync(claudeProjectsPath);
    logger.info(`\n${c.info('[INFO]')} Claude Projects Folder:`);
    logger.info(`       ${c.dim(claudeProjectsPath)}`);
    logger.info(`       Status: ${projectsExists ? c.ok('[OK] Exists') : c.warn('[WARN] Not found')}`);

    // 配置文件位置
    const envFilePath = path.join(__dirname, '../.env');
    const envExists = fs.existsSync(envFilePath);
    logger.info(`\n${c.info('[INFO]')} Configuration File:`);
    logger.info(`       ${c.dim(envFilePath)}`);
    logger.info(`       Status: ${envExists ? c.ok('[OK] Exists') : c.warn('[WARN] Not found (using defaults)')}`);

    logger.info('\n' + c.dim('═'.repeat(60)));
    logger.info(`\n${c.tip('[TIP]')} Hints:`);
    logger.info(`      ${c.dim('>')} Use ${c.bright('cloudcli --port 8080')} to run on a custom port`);
    logger.info(`      ${c.dim('>')} Use ${c.bright('cloudcli --database-path /path/to/db')} for custom database`);
    logger.info(`      ${c.dim('>')} Run ${c.bright('cloudcli help')} for all options`);
    logger.info(`      ${c.dim('>')} Access the UI at http://localhost:${SERVER.port}\n`);
}

// 显示帮助
function showHelp() {
    logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║              Claude Code UI - Command Line Tool               ║
╚═══════════════════════════════════════════════════════════════╝

Usage:
  claude-code-ui [command] [options]
  cloudcli [command] [options]

Commands:
  start          Start the Claude Code UI server (default)
  status         Show configuration and data locations
  update         Update to the latest version
  help           Show this help information
  version        Show version information

Options:
  -p, --port <port>           Set server port (default: 3001)
  --database-path <path>      Set custom database location
  -h, --help                  Show this help information
  -v, --version               Show version information

Examples:
  $ cloudcli                        # Start with defaults
  $ cloudcli --port 8080            # Start on port 8080
  $ cloudcli -p 3000                # Short form for port
  $ cloudcli start --port 4000      # Explicit start command
  $ cloudcli status                 # Show configuration

Environment Variables:
  PORT                Set server port (default: 3001)
  DATABASE_PATH       Set custom database location
  CLAUDE_CLI_PATH     Set custom Claude CLI path
  CONTEXT_WINDOW      Set context window size (default: 160000)

Documentation:
  ${packageJson.homepage || 'https://github.com/domonic18/ai-claude-code-ui'}

Report Issues:
  ${packageJson.bugs?.url || 'https://github.com/domonic18/ai-claude-code-ui/issues'}
`);
}

// 显示版本
function showVersion() {
    logger.info(`${packageJson.version}`);
}

// 比较语义化版本，如果 v1 > v2 则返回 true
function isNewerVersion(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (parts1[i] > parts2[i]) return true;
        if (parts1[i] < parts2[i]) return false;
    }
    return false;
}

// Check for updates
async function checkForUpdates(silent = false) {
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

// 更新包
async function updatePackage() {
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

// 启动服务器
async function startServer() {
    // 启动时静默检查更新
    checkForUpdates(true);

    // 导入并运行服务器
    await import('./index.js');
}

// 解析 CLI 参数
function parseArgs(args) {
    const parsed = { command: 'start', options: {} };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--port' || arg === '-p') {
            parsed.options.port = args[++i];
        } else if (arg.startsWith('--port=')) {
            parsed.options.port = arg.split('=')[1];
        } else if (arg === '--database-path') {
            parsed.options.databasePath = args[++i];
        } else if (arg.startsWith('--database-path=')) {
            parsed.options.databasePath = arg.split('=')[1];
        } else if (arg === '--help' || arg === '-h') {
            parsed.command = 'help';
        } else if (arg === '--version' || arg === '-v') {
            parsed.command = 'version';
        } else if (!arg.startsWith('-')) {
            parsed.command = arg;
        }
    }

    return parsed;
}

// 主 CLI 处理函数
async function main() {
    const args = process.argv.slice(2);
    const { command, options } = parseArgs(args);

    // 注意：loadEnvironment() 已在 config.js 模块加载时自动调用
    // CLI 参数覆盖（注意：这些覆盖不会反映在已加载的配置常量中）
    if (options.port) {
        process.env.PORT = options.port;
    }
    if (options.databasePath) {
        process.env.DATABASE_PATH = options.databasePath;
    }

    switch (command) {
        case 'start':
            await startServer();
            break;
        case 'status':
        case 'info':
            showStatus();
            break;
        case 'help':
        case '-h':
        case '--help':
            showHelp();
            break;
        case 'version':
        case '-v':
        case '--version':
            showVersion();
            break;
        case 'update':
            await updatePackage();
            break;
        default:
            logger.error(`\n❌ Unknown command: ${command}`);
            logger.info('   Run "cloudcli help" for usage information.\n');
            process.exit(1);
    }
}

// 运行 CLI
main().catch(error => {
    logger.error('\n❌ Error:', error.message);
    process.exit(1);
});
