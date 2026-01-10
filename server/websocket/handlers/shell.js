/**
 * Shell WebSocket 处理器
 *
 * 处理用于 shell/终端交互的 WebSocket 连接。
 * 管理 PTY（伪终端）会话，支持缓存和
 * 不同的提供商（Claude、Cursor、普通 shell）。
 *
 * @module websocket/handlers/shell
 */

import os from 'os';
import pty from 'node-pty';
import { WebSocket } from 'ws';

// PTY 会话超时配置
const PTY_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 分钟

/**
 * 处理 shell WebSocket 连接
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Map} ptySessionsMap - 用于管理 PTY 会话的映射
 */
export function handleShellConnection(ws, ptySessionsMap) {
    console.log('🐚 Shell client connected');
    let shellProcess = null;
    let ptySessionKey = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Shell message received:', data.type);

            if (data.type === 'init') {
                const projectPath = data.projectPath || process.cwd();
                const sessionId = data.sessionId;
                const hasSession = data.hasSession;
                const provider = data.provider || 'claude';
                const initialCommand = data.initialCommand;
                const isPlainShell = data.isPlainShell || (!!initialCommand && !hasSession) || provider === 'plain-shell';

                // 登录命令（Claude/Cursor 身份验证）不应重用缓存的会话
                const isLoginCommand = initialCommand && (
                    initialCommand.includes('setup-token') ||
                    initialCommand.includes('cursor-agent login') ||
                    initialCommand.includes('auth login')
                );

                // 在会话键中包含命令哈希，以便不同的命令获得单独的会话
                const commandSuffix = isPlainShell && initialCommand
                    ? `_cmd_${Buffer.from(initialCommand).toString('base64').slice(0, 16)}`
                    : '';
                ptySessionKey = `${projectPath}_${sessionId || 'default'}${commandSuffix}`;

                // 在启动新会话之前，终止任何现有的登录会话
                if (isLoginCommand) {
                    const oldSession = ptySessionsMap.get(ptySessionKey);
                    if (oldSession) {
                        console.log('🧹 Cleaning up existing login session:', ptySessionKey);
                        if (oldSession.timeoutId) clearTimeout(oldSession.timeoutId);
                        if (oldSession.pty && oldSession.pty.kill) oldSession.pty.kill();
                        ptySessionsMap.delete(ptySessionKey);
                    }
                }

                const existingSession = isLoginCommand ? null : ptySessionsMap.get(ptySessionKey);
                if (existingSession) {
                    console.log('♻️  Reconnecting to existing PTY session:', ptySessionKey);
                    shellProcess = existingSession.pty;

                    clearTimeout(existingSession.timeoutId);

                    ws.send(JSON.stringify({
                        type: 'output',
                        data: `\x1b[36m[Reconnected to existing session]\x1b[0m\r\n`
                    }));

                    if (existingSession.buffer && existingSession.buffer.length > 0) {
                        console.log(`📜 Sending ${existingSession.buffer.length} buffered messages`);
                        existingSession.buffer.forEach(bufferedData => {
                            ws.send(JSON.stringify({
                                type: 'output',
                                data: bufferedData
                            }));
                        });
                    }

                    existingSession.ws = ws;

                    return;
                }

                console.log('[INFO] Starting shell in:', projectPath);
                console.log('📋 Session info:', hasSession ? `Resume session ${sessionId}` : (isPlainShell ? 'Plain shell mode' : 'New session'));
                console.log('🤖 Provider:', isPlainShell ? 'plain-shell' : provider);
                if (initialCommand) {
                    console.log('⚡ Initial command:', initialCommand);
                }

                // First send a welcome message
                let welcomeMsg;
                if (isPlainShell) {
                    welcomeMsg = `\x1b[36mStarting terminal in: ${projectPath}\x1b[0m\r\n`;
                } else {
                    const providerName = provider === 'cursor' ? 'Cursor' : 'Claude';
                    welcomeMsg = hasSession ?
                        `\x1b[36mResuming ${providerName} session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
                        `\x1b[36mStarting new ${providerName} session in: ${projectPath}\x1b[0m\r\n`;
                }

                ws.send(JSON.stringify({
                    type: 'output',
                    data: welcomeMsg
                }));

                try {
                    // 准备适应平台和提供商的 shell 命令
                    let shellCommand;
                    if (isPlainShell) {
                        // 普通 shell 模式 - 仅在项目目录中运行初始命令
                        if (os.platform() === 'win32') {
                            shellCommand = `Set-Location -Path "${projectPath}"; ${initialCommand}`;
                        } else {
                            shellCommand = `cd "${projectPath}" && ${initialCommand}`;
                        }
                    } else if (provider === 'cursor') {
                        // 使用 cursor-agent 命令
                        if (os.platform() === 'win32') {
                            if (hasSession && sessionId) {
                                shellCommand = `Set-Location -Path "${projectPath}"; cursor-agent --resume="${sessionId}"`;
                            } else {
                                shellCommand = `Set-Location -Path "${projectPath}"; cursor-agent`;
                            }
                        } else {
                            if (hasSession && sessionId) {
                                shellCommand = `cd "${projectPath}" && cursor-agent --resume="${sessionId}"`;
                            } else {
                                shellCommand = `cd "${projectPath}" && cursor-agent`;
                            }
                        }
                    } else {
                        // 使用 claude 命令（默认）或提供的 initialCommand
                        const command = initialCommand || 'claude';
                        if (os.platform() === 'win32') {
                            if (hasSession && sessionId) {
                                // 尝试恢复会话，如果失败则回退到新会话
                                shellCommand = `Set-Location -Path "${projectPath}"; claude --resume ${sessionId}; if ($LASTEXITCODE -ne 0) { claude }`;
                            } else {
                                shellCommand = `Set-Location -Path "${projectPath}"; ${command}`;
                            }
                        } else {
                            if (hasSession && sessionId) {
                                shellCommand = `cd "${projectPath}" && claude --resume ${sessionId} || claude`;
                            } else {
                                shellCommand = `cd "${projectPath}" && ${command}`;
                            }
                        }
                    }

                    console.log('🔧 Executing shell command:', shellCommand);

                    // 根据平台使用适当的 shell
                    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
                    const shellArgs = os.platform() === 'win32' ? ['-Command', shellCommand] : ['-c', shellCommand];

                    // 使用客户端提供的终端尺寸（如果提供），否则使用默认值
                    const termCols = data.cols || 80;
                    const termRows = data.rows || 24;
                    console.log('📐 Using terminal dimensions:', termCols, 'x', termRows);

                    shellProcess = pty.spawn(shell, shellArgs, {
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

                    ptySessionsMap.set(ptySessionKey, {
                        pty: shellProcess,
                        ws: ws,
                        buffer: [],
                        timeoutId: null,
                        projectPath,
                        sessionId
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

                            // 检查各种 URL 打开模式
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

                            patterns.forEach(pattern => {
                                let match;
                                while ((match = pattern.exec(data)) !== null) {
                                    const url = match[1];
                                    console.log('[DEBUG] Detected URL for opening:', url);

                                    // 向客户端发送 URL 打开消息
                                    session.ws.send(JSON.stringify({
                                        type: 'url_open',
                                        url: url
                                    }));

                                    // 将 OPEN_URL 模式替换为用户友好的消息
                                    if (pattern.source.includes('OPEN_URL')) {
                                        outputData = outputData.replace(match[0], `[INFO] Opening in browser: ${url}`);
                                    }
                                }
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
                        shellProcess = null;
                    });

                } catch (spawnError) {
                    console.error('[ERROR] Error spawning process:', spawnError);
                    ws.send(JSON.stringify({
                        type: 'output',
                        data: `\r\n\x1b[31mError: ${spawnError.message}\x1b[0m\r\n`
                    }));
                }

            } else if (data.type === 'input') {
                // 向 shell 进程发送输入
                if (shellProcess && shellProcess.write) {
                    try {
                        shellProcess.write(data.data);
                    } catch (error) {
                        console.error('Error writing to shell:', error);
                    }
                } else {
                    console.warn('No active shell process to send input to');
                }
            } else if (data.type === 'resize') {
                // 处理终端调整大小
                if (shellProcess && shellProcess.resize) {
                    console.log('Terminal resize requested:', data.cols, 'x', data.rows);
                    shellProcess.resize(data.cols, data.rows);
                }
            }
        } catch (error) {
            console.error('[ERROR] Shell WebSocket error:', error.message);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
                }));
            }
        }
    });

    ws.on('close', () => {
        console.log('🔌 Shell client disconnected');

        if (ptySessionKey) {
            const session = ptySessionsMap.get(ptySessionKey);
            if (session) {
                console.log('⏳ PTY session kept alive, will timeout in 30 minutes:', ptySessionKey);
                session.ws = null;

                session.timeoutId = setTimeout(() => {
                    console.log('⏰ PTY session timeout, killing process:', ptySessionKey);
                    if (session.pty && session.pty.kill) {
                        session.pty.kill();
                    }
                    ptySessionsMap.delete(ptySessionKey);
                }, PTY_SESSION_TIMEOUT);
            }
        }
    });

    ws.on('error', (error) => {
        console.error('[ERROR] Shell WebSocket error:', error);
    });
}

export { PTY_SESSION_TIMEOUT };
