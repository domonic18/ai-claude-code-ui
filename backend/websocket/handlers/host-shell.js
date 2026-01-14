/**
 * 主机模式 Shell 处理器
 *
 * 处理主机模式下的 shell WebSocket 连接。
 * 在主机模式下，shell 会话使用 node-pty 在宿主机上创建。
 *
 * @module websocket/handlers/host-shell
 */

import os from 'os';
import pty from 'node-pty';
import { WebSocket } from 'ws';
import { PTY_SESSION_TIMEOUT } from './shell-constants.js';

/**
 * 生成主机模式的 shell 命令
 *
 * @param {Object} params - 参数
 * @param {string} params.projectPath - 项目路径
 * @param {boolean} params.hasSession - 是否有现有会话
 * @param {string} params.sessionId - 会话 ID
 * @param {string} params.provider - 提供商（claude、cursor）
 * @param {string} params.initialCommand - 初始命令
 * @param {boolean} params.isPlainShell - 是否为普通 shell 模式
 * @returns {string} shell 命令
 */
function buildShellCommand({ projectPath, hasSession, sessionId, provider, initialCommand, isPlainShell }) {
    if (isPlainShell) {
        // 普通 shell 模式 - 仅在项目目录中运行初始命令
        if (os.platform() === 'win32') {
            return `Set-Location -Path "${projectPath}"; ${initialCommand}`;
        } else {
            return `cd "${projectPath}" && ${initialCommand}`;
        }
    } else if (provider === 'cursor') {
        // 使用 cursor-agent 命令
        if (os.platform() === 'win32') {
            if (hasSession && sessionId) {
                return `Set-Location -Path "${projectPath}"; cursor-agent --resume="${sessionId}"`;
            } else {
                return `Set-Location -Path "${projectPath}"; cursor-agent`;
            }
        } else {
            if (hasSession && sessionId) {
                return `cd "${projectPath}" && cursor-agent --resume="${sessionId}"`;
            } else {
                return `cd "${projectPath}" && cursor-agent`;
            }
        }
    } else {
        // 使用 claude 命令（默认）或提供的 initialCommand
        const command = initialCommand || 'claude';
        if (os.platform() === 'win32') {
            if (hasSession && sessionId) {
                // 尝试恢复会话，如果失败则回退到新会话
                return `Set-Location -Path "${projectPath}"; claude --resume ${sessionId}; if ($LASTEXITCODE -ne 0) { claude }`;
            } else {
                return `Set-Location -Path "${projectPath}"; ${command}`;
            }
        } else {
            if (hasSession && sessionId) {
                return `cd "${projectPath}" && claude --resume ${sessionId} || claude`;
            } else {
                return `cd "${projectPath}" && ${command}`;
            }
        }
    }
}

/**
 * 生成欢迎消息
 *
 * @param {Object} params - 参数
 * @param {string} params.projectPath - 项目路径
 * @param {boolean} params.hasSession - 是否有现有会话
 * @param {string} params.sessionId - 会话 ID
 * @param {string} params.provider - 提供商（claude、cursor）
 * @param {boolean} params.isPlainShell - 是否为普通 shell 模式
 * @returns {string} 欢迎消息
 */
function buildWelcomeMessage({ projectPath, hasSession, sessionId, provider, isPlainShell }) {
    if (isPlainShell) {
        return `\x1b[36mStarting terminal in: ${projectPath}\x1b[0m\r\n`;
    } else {
        const providerName = provider === 'cursor' ? 'Cursor' : 'Claude';
        return hasSession ?
            `\x1b[36mResuming ${providerName} session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
            `\x1b[36mStarting new ${providerName} session in: ${projectPath}\x1b[0m\r\n`;
    }
}

/**
 * 检测 URL 打开模式并提取 URL
 *
 * @param {string} data - 输出数据
 * @returns {Array<string>} 检测到的 URL 数组
 */
function detectOpenUrls(data) {
    const patterns = [
        // 直接浏览器打开命令
        /(?:xdg-open|open|start)\s+(https?:\/\/[^\s\x1b\x07]+)/g,
        // BROWSER 环境变量覆盖
        /OPEN_URL:\s*(https?:\/\/[^\s\x1b\x07]+)/g,
        // Git 和其他工具打开 URL
        /Opening\s+(https?:\/\/[^\s\x1b\x07]+)/gi,
        // 可能被打开的常规 URL 模式
        /Visit:\s*(https?:\/\/[^\s\x1b\x07]+)/gi,
        /View at:\s*(https?:\/\/[^\s\x1b\x07]+)/gi,
        /Browse to:\s*(https?:\/\/[^\s\x1b\x07]+)/gi
    ];

    const urls = [];
    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(data)) !== null) {
            urls.push(match[1]);
        }
    });

    return urls;
}

/**
 * 处理主机模式下的 shell WebSocket 连接
 *
 * 在主机模式下，shell 会话使用 node-pty 在宿主机上创建。
 *
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Object} data - 初始化数据
 * @param {string} data.projectPath - 项目路径
 * @param {string} data.sessionId - 会话 ID
 * @param {boolean} data.hasSession - 是否有现有会话
 * @param {string} data.provider - 提供商（claude、cursor）
 * @param {string} data.initialCommand - 初始命令
 * @param {number} data.cols - 终端列数
 * @param {number} data.rows - 终端行数
 * @param {boolean} data.isPlainShell - 是否为普通 shell 模式
 * @param {Map} ptySessionsMap - PTY 会话映射
 * @returns {string} 会话键
 */
export function handleHostShell(ws, data, ptySessionsMap) {
    const { projectPath, sessionId, hasSession, provider, initialCommand, cols = 80, rows = 24 } = data;
    const isPlainShell = data.isPlainShell || (!!initialCommand && !hasSession) || provider === 'plain-shell';

    console.log('[INFO] Starting shell in:', projectPath);
    console.log('📋 Session info:', hasSession ? `Resume session ${sessionId}` : (isPlainShell ? 'Plain shell mode' : 'New session'));
    console.log('🤖 Provider:', isPlainShell ? 'plain-shell' : provider);
    if (initialCommand) {
        console.log('⚡ Initial command:', initialCommand);
    }

    // 发送欢迎消息
    const welcomeMsg = buildWelcomeMessage({ projectPath, hasSession, sessionId, provider, isPlainShell });
    ws.send(JSON.stringify({
        type: 'output',
        data: welcomeMsg
    }));

    try {
        // 准备适应平台和提供商的 shell 命令
        const shellCommand = buildShellCommand({ projectPath, hasSession, sessionId, provider, initialCommand, isPlainShell });
        console.log('🔧 Executing shell command:', shellCommand);

        // 根据平台使用适当的 shell
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        const shellArgs = os.platform() === 'win32' ? ['-Command', shellCommand] : ['-c', shellCommand];

        // 使用客户端提供的终端尺寸（如果提供），否则使用默认值
        const termCols = cols || 80;
        const termRows = rows || 24;
        console.log('📐 Using terminal dimensions:', termCols, 'x', termRows);

        const shellProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color',
            cols: termCols,
            rows: termRows,
            cwd: os.homedir(),
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
                FORCE_COLOR: '3',
                // 覆盖浏览器打开命令以回显 URL 进行检测
                BROWSER: os.platform() === 'win32' ? 'echo "OPEN_URL:"' : 'echo "OPEN_URL:"'
            }
        });

        console.log('🟢 Shell process started with PTY, PID:', shellProcess.pid);

        // 在会话键中包含命令哈希，以便不同的命令获得单独的会话
        const commandSuffix = isPlainShell && initialCommand
            ? `_cmd_${Buffer.from(initialCommand).toString('base64').slice(0, 16)}`
            : '';
        const ptySessionKey = `${projectPath}_${sessionId || 'default'}${commandSuffix}`;

        ptySessionsMap.set(ptySessionKey, {
            pty: shellProcess,
            ws: ws,
            buffer: [],
            timeoutId: null,
            projectPath,
            sessionId,
            resize: (newCols, newRows) => {
                shellProcess.resize(newCols, newRows);
            },
            write: (data) => {
                shellProcess.write(data);
            },
            kill: () => {
                shellProcess.kill();
            }
        });

        // 处理数据输出
        shellProcess.onData((data) => {
            const session = ptySessionsMap.get(ptySessionKey);
            if (!session) return;

            if (session.buffer.length < 5000) {
                session.buffer.push(data);
            } else {
                session.buffer.shift();
                session.buffer.push(data);
            }

            if (session.ws && session.ws.readyState === WebSocket.OPEN) {
                let outputData = data;

                // 检测 URL 打开
                const urls = detectOpenUrls(data);
                urls.forEach(url => {
                    console.log('[DEBUG] Detected URL for opening:', url);

                    // 向客户端发送 URL 打开消息
                    session.ws.send(JSON.stringify({
                        type: 'url_open',
                        url: url
                    }));

                    // 将 OPEN_URL 模式替换为用户友好的消息
                    outputData = outputData.replace(
                        new RegExp(`OPEN_URL:\\s*${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
                        `[INFO] Opening in browser: ${url}`
                    );
                });

                // 发送常规输出
                session.ws.send(JSON.stringify({
                    type: 'output',
                    data: outputData
                }));
            }
        });

        // 处理进程退出
        shellProcess.onExit((exitCode) => {
            console.log('🔚 Shell process exited with code:', exitCode.exitCode, 'signal:', exitCode.signal);
            const session = ptySessionsMap.get(ptySessionKey);
            if (session && session.ws && session.ws.readyState === WebSocket.OPEN) {
                session.ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[33mProcess exited with code ${exitCode.exitCode}${exitCode.signal ? ` (${exitCode.signal})` : ''}\x1b[0m\r\n`
                }));
            }
            if (session && session.timeoutId) {
                clearTimeout(session.timeoutId);
            }
            ptySessionsMap.delete(ptySessionKey);
        });

        return ptySessionKey;

    } catch (spawnError) {
        console.error('[ERROR] Error spawning process:', spawnError);
        ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: ${spawnError.message}\x1b[0m\r\n`
        }));
        return null;
    }
}

/**
 * 检查是否为登录命令
 *
 * @param {string} initialCommand - 初始命令
 * @returns {boolean} 是否为登录命令
 */
export function isLoginCommand(initialCommand) {
    return initialCommand && (
        initialCommand.includes('setup-token') ||
        initialCommand.includes('cursor-agent login') ||
        initialCommand.includes('auth login')
    );
}
