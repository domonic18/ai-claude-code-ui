/**
 * CLI Command Handlers
 *
 * 提供CLI命令处理逻辑
 *
 * @module cli/cliCommands
 */

import { createLogger } from '../utils/logger.js';
import { showStatus, showHelp, showVersion } from './display.js';
import { updatePackage } from './updates.js';

const logger = createLogger('cli');

// 启动服务器并检查更新，作为默认命令
/**
 * 启动服务器
 */
async function startServer() {
    // 启动时静默检查更新
    const { checkForUpdates } = await import('./updates.js');
    checkForUpdates(true);

    // 导入并运行服务器
    await import('../index.js');
}

// 执行用户输入的 CLI 命令，作为命令行入口
/**
 * 执行CLI命令
 * @param {string} command - 命令名称
 * @param {Object} options - 命令选项
 */
export async function executeCommand(command, options) {
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
