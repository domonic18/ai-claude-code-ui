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

import { createLogger } from './utils/logger.js';
import { executeCommand } from './cli/cliCommands.js';

const logger = createLogger('cli');
const OPTION_DEFINITIONS = [
    { flags: ['--port', '-p'], key: 'port', hasValue: true },
    { flags: ['--database-path'], key: 'databasePath', hasValue: true },
    { flags: ['--help', '-h'], key: 'help', command: 'help' },
    { flags: ['--version', '-v'], key: 'version', command: 'version' },
];

function parseArgs(args) {
    const parsed = { command: 'start', options: {} };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        let matched = false;

        for (const def of OPTION_DEFINITIONS) {
            if (def.flags.includes(arg)) {
                if (def.hasValue) {
                    parsed.options[def.key] = args[++i];
                } else if (def.command) {
                    parsed.command = def.command;
                }
                matched = true;
                break;
            }

            for (const flag of def.flags) {
                if (flag.startsWith('--') && arg.startsWith(flag + '=')) {
                    if (def.hasValue) {
                        parsed.options[def.key] = arg.split('=')[1];
                    }
                    matched = true;
                    break;
                }
            }

            if (matched) break;
        }

        if (!matched && !arg.startsWith('-')) {
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

    await executeCommand(command, options);
}

// 运行 CLI
main().catch(error => {
    logger.error({ err: error }, 'CLI error');
    process.exit(1);
});
