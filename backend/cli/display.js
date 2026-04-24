/**
 * CLI Display Functions
 *
 * 提供命令行界面的显示功能，包括状态、帮助和版本信息
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadEnvironment, DATABASE, SERVER, CLAUDE } from '../config/config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('cli-display');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 package.json 以获取版本信息
const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 获取数据库文件路径，用于状态显示
/**
 * 获取数据库路径
 * @returns {string} 数据库文件路径
 */
export function getDatabasePath() {
    return DATABASE.path;
}

// 获取应用安装目录路径，用于状态显示
/**
 * 获取安装目录
 * @returns {string} 安装目录路径
 */
export function getInstallDir() {
    return path.join(__dirname, '../..');
}

// 显示应用状态信息，包括版本、配置、数据库等，供 `status` 命令调用
/**
 * 显示状态命令
 * 显示配置信息、数据库位置、版本信息等
 */
export function showStatus() {
    logger.info('=== Claude Code UI Status ===');

    // 版本信息
    logger.info({ version: packageJson.version }, 'Version');

    // 安装位置
    const installDir = getInstallDir();
    logger.info({ installDir }, 'Installation directory');

    // 数据库位置
    const dbPath = getDatabasePath();
    const dbExists = fs.existsSync(dbPath);
    logger.info({ dbPath, exists: dbExists }, 'Database');

    if (dbExists) {
        const stats = fs.statSync(dbPath);
        logger.info({ size: `${(stats.size / 1024).toFixed(2)} KB`, modified: stats.mtime.toISOString() }, 'Database stats');
    }

    // 环境变量
    logger.info({
        port: SERVER.port,
        portDefault: !process.env.PORT,
        databasePath: DATABASE.path,
        cliPath: CLAUDE.cliPath,
        contextWindow: CLAUDE.contextWindow,
    }, 'Configuration');

    // Claude 项目文件夹
    const claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');
    const projectsExists = fs.existsSync(claudeProjectsPath);
    logger.info({ path: claudeProjectsPath, exists: projectsExists }, 'Claude projects folder');

    // 配置文件位置
    const envFilePath = path.join(__dirname, '../../.env');
    const envExists = fs.existsSync(envFilePath);
    logger.info({ path: envFilePath, exists: envExists }, 'Configuration file');
}

// 显示命令行工具帮助信息，供 `help` 命令调用
/**
 * 显示帮助信息
 * 显示命令行工具的使用说明、可用命令和选项
 */
export function showHelp() {
    logger.info(`
Claude Code UI - Command Line Tool

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

// 显示当前应用版本号，供 `version` 命令调用
/**
 * 显示版本信息
 * 输出当前软件版本号
 */
export function showVersion() {
    logger.info({ version: packageJson.version }, 'Version');
}
