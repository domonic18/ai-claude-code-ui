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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 用于终端输出的 ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',

    // 前景色
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
};

// 文本着色辅助函数
const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    ok: (text) => `${colors.green}${text}${colors.reset}`,
    warn: (text) => `${colors.yellow}${text}${colors.reset}`,
    error: (text) => `${colors.yellow}${text}${colors.reset}`,
    tip: (text) => `${colors.blue}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};

// 加载 package.json 以获取版本信息
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 如果 .env 文件存在，则从中加载环境变量
function loadEnvFile() {
    try {
        const envPath = path.join(__dirname, '../.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                if (key && valueParts.length > 0 && !process.env[key]) {
                    process.env[key] = valueParts.join('=').trim();
                }
            }
        });
    } catch (e) {
        // .env 文件是可选的
    }
}

// 获取数据库路径（与 db.js 中的逻辑相同）
function getDatabasePath() {
    loadEnvFile();
    return process.env.DATABASE_PATH || path.join(__dirname, 'database', 'auth.db');
}

// 获取安装目录
function getInstallDir() {
    return path.join(__dirname, '..');
}

// 显示状态命令
function showStatus() {
    console.log(`\n${c.bright('Claude Code UI - Status')}\n`);
    console.log(c.dim('═'.repeat(60)));

    // 版本信息
    console.log(`\n${c.info('[INFO]')} Version: ${c.bright(packageJson.version)}`);

    // 安装位置
    const installDir = getInstallDir();
    console.log(`\n${c.info('[INFO]')} Installation Directory:`);
    console.log(`       ${c.dim(installDir)}`);

    // 数据库位置
    const dbPath = getDatabasePath();
    const dbExists = fs.existsSync(dbPath);
    console.log(`\n${c.info('[INFO]')} Database Location:`);
    console.log(`       ${c.dim(dbPath)}`);
    console.log(`       Status: ${dbExists ? c.ok('[OK] Exists') : c.warn('[WARN] Not created yet (will be created on first run)')}`);

    if (dbExists) {
        const stats = fs.statSync(dbPath);
        console.log(`       Size: ${c.dim((stats.size / 1024).toFixed(2) + ' KB')}`);
        console.log(`       Modified: ${c.dim(stats.mtime.toLocaleString())}`);
    }

    // 环境变量
    console.log(`\n${c.info('[INFO]')} Configuration:`);
    console.log(`       PORT: ${c.bright(process.env.PORT || '3001')} ${c.dim(process.env.PORT ? '' : '(default)')}`);
    console.log(`       DATABASE_PATH: ${c.dim(process.env.DATABASE_PATH || '(using default location)')}`);
    console.log(`       CLAUDE_CLI_PATH: ${c.dim(process.env.CLAUDE_CLI_PATH || 'claude (default)')}`);
    console.log(`       CONTEXT_WINDOW: ${c.dim(process.env.CONTEXT_WINDOW || '160000 (default)')}`);

    // Claude 项目文件夹
    const claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');
    const projectsExists = fs.existsSync(claudeProjectsPath);
    console.log(`\n${c.info('[INFO]')} Claude Projects Folder:`);
    console.log(`       ${c.dim(claudeProjectsPath)}`);
    console.log(`       Status: ${projectsExists ? c.ok('[OK] Exists') : c.warn('[WARN] Not found')}`);

    // 配置文件位置
    const envFilePath = path.join(__dirname, '../.env');
    const envExists = fs.existsSync(envFilePath);
    console.log(`\n${c.info('[INFO]')} Configuration File:`);
    console.log(`       ${c.dim(envFilePath)}`);
    console.log(`       Status: ${envExists ? c.ok('[OK] Exists') : c.warn('[WARN] Not found (using defaults)')}`);

    console.log('\n' + c.dim('═'.repeat(60)));
    console.log(`\n${c.tip('[TIP]')} Hints:`);
    console.log(`      ${c.dim('>')} Use ${c.bright('cloudcli --port 8080')} to run on a custom port`);
    console.log(`      ${c.dim('>')} Use ${c.bright('cloudcli --database-path /path/to/db')} for custom database`);
    console.log(`      ${c.dim('>')} Run ${c.bright('cloudcli help')} for all options`);
    console.log(`      ${c.dim('>')} Access the UI at http://localhost:${process.env.PORT || '3001'}\n`);
}

// 显示帮助
function showHelp() {
    console.log(`
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
  ${packageJson.homepage || 'https://github.com/siteboon/claudecodeui'}

Report Issues:
  ${packageJson.bugs?.url || 'https://github.com/siteboon/claudecodeui/issues'}
`);
}

// 显示版本
function showVersion() {
    console.log(`${packageJson.version}`);
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
        const latestVersion = execSync('npm show @siteboon/claude-code-ui version', { encoding: 'utf8' }).trim();
        const currentVersion = packageJson.version;

        if (isNewerVersion(latestVersion, currentVersion)) {
            console.log(`\n${c.warn('[UPDATE]')} New version available: ${c.bright(latestVersion)} (current: ${currentVersion})`);
            console.log(`         Run ${c.bright('cloudcli update')} to update\n`);
            return { hasUpdate: true, latestVersion, currentVersion };
        } else if (!silent) {
            console.log(`${c.ok('[OK]')} You are on the latest version (${currentVersion})`);
        }
        return { hasUpdate: false, latestVersion, currentVersion };
    } catch (e) {
        if (!silent) {
            console.log(`${c.warn('[WARN]')} Could not check for updates`);
        }
        return { hasUpdate: false, error: e.message };
    }
}

// 更新包
async function updatePackage() {
    try {
        const { execSync } = await import('child_process');
        console.log(`${c.info('[INFO]')} Checking for updates...`);

        const { hasUpdate, latestVersion, currentVersion } = await checkForUpdates(true);

        if (!hasUpdate) {
            console.log(`${c.ok('[OK]')} Already on the latest version (${currentVersion})`);
            return;
        }

        console.log(`${c.info('[INFO]')} Updating from ${currentVersion} to ${latestVersion}...`);
        execSync('npm update -g @siteboon/claude-code-ui', { stdio: 'inherit' });
        console.log(`${c.ok('[OK]')} Update complete! Restart cloudcli to use the new version.`);
    } catch (e) {
        console.error(`${c.error('[ERROR]')} Update failed: ${e.message}`);
        console.log(`${c.tip('[TIP]')} Try running manually: npm update -g @siteboon/claude-code-ui`);
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

    // 将 CLI 选项应用到环境变量
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
            console.error(`\n❌ Unknown command: ${command}`);
            console.log('   Run "cloudcli help" for usage information.\n');
            process.exit(1);
    }
}

// 运行 CLI
main().catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
});
