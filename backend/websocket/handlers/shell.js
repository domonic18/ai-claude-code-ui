/**
 * Shell WebSocket 处理器
 *
 * 处理用于 shell/终端交互的 WebSocket 连接。
 * 管理 PTY（伪终端）会话，支持缓存和
 * 不同的提供商（Claude、Cursor、普通 shell）。
 *
 * 支持两种模式：
 * - 主机模式：使用 node-pty 在宿主机上创建 PTY
 * - 容器模式：在 Docker 容器内执行 shell 命令
 *
 * @module websocket/handlers/shell
 */

import os from 'os';
import pty from 'node-pty';
import { WebSocket } from 'ws';
import { CONTAINER } from '../../config/config.js';
import containerManager from '../../services/container/core/index.js';

// PTY 会话超时配置
const PTY_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 分钟

/**
 * 处理容器模式下的 shell WebSocket 连接
 *
 * 在容器模式下，shell 会话通过 Docker exec 在容器内运行。
 * 我们使用 docker exec -it 来创建一个交互式 TTY 会话。
 *
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Object} data - 初始化数据
 * @param {Map} ptySessionsMap - PTY 会话映射
 */
async function handleContainerShell(ws, data, ptySessionsMap) {
    const { projectPath, sessionId, hasSession, provider, initialCommand, cols = 80, rows = 24 } = data;
    const isPlainShell = data.isPlainShell || (!!initialCommand && !hasSession) || provider === 'plain-shell';
    // authenticateWebSocket returns { userId, username }, not { id, username }
    const userId = ws.user?.userId || ws.user?.id;

    console.log('[Container Shell] Function called, userId:', userId);
    console.log('[Container Shell] Project path:', projectPath);
    console.log('[Container Shell] Provider:', provider);
    console.log('[Container Shell] SessionId:', sessionId);

    if (!userId) {
        console.log('[Container Shell] No userId, closing connection');
        ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: User authentication required\x1b[0m\r\n`
        }));
        ws.close();
        return;
    }

    // 会话键
    const commandSuffix = isPlainShell && initialCommand
        ? `_cmd_${Buffer.from(initialCommand).toString('base64').slice(0, 16)}`
        : '';
    const ptySessionKey = `container_${userId}_${projectPath}_${sessionId || 'default'}${commandSuffix}`;

    console.log('[Container Shell] Project:', projectPath);
    console.log('[Container Shell] Session key:', ptySessionKey);
    console.log('[Container Shell] Provider:', provider);
    console.log('[Container Shell] Initial command:', initialCommand || 'none');
    console.log('[Container Shell] Terminal size:', cols, 'x', rows);

    // 欢迎消息
    let welcomeMsg;
    if (isPlainShell) {
        welcomeMsg = `\x1b[36mContainer Shell: ${projectPath}\x1b[0m\r\n`;
    } else {
        const providerName = provider === 'cursor' ? 'Cursor' : 'Claude';
        welcomeMsg = hasSession ?
            `\x1b[36mResuming ${providerName} session in container: ${projectPath}\x1b[0m\r\n` :
            `\x1b[36mStarting new ${providerName} session in container: ${projectPath}\x1b[0m\r\n`;
    }

    ws.send(JSON.stringify({
        type: 'output',
        data: welcomeMsg
    }));

    // 构建容器内的工作目录
    const containerWorkDir = `/workspace/${projectPath}`;

    // 构建命令
    let shellCommand;
    if (isPlainShell) {
        // 普通 shell 模式：直接运行命令
        shellCommand = `cd "${containerWorkDir}" && ${initialCommand}`;
    } else if (provider === 'cursor') {
        // Cursor 模式
        if (hasSession && sessionId) {
            shellCommand = `cd "${containerWorkDir}" && cursor-agent --resume="${sessionId}"`;
        } else {
            shellCommand = `cd "${containerWorkDir}" && cursor-agent`;
        }
    } else {
        // Claude 模式（默认）
        if (hasSession && sessionId) {
            shellCommand = `cd "${containerWorkDir}" && claude --resume ${sessionId} || claude`;
        } else {
            shellCommand = `cd "${containerWorkDir}" && claude`;
        }
    }

    console.log('[Container Shell] Executing command:', shellCommand);

    try {
        // 使用 attach 方法获取可写的 Duplex 流
        const attachResult = await containerManager.attachToContainerShell(userId, {
            workingDir: containerWorkDir,
            cols,
            rows
        });

        const stream = attachResult.stream;
        console.log('[Container Shell] Attached to container, stream type:', stream?.constructor?.name, 'writable:', stream?.writable);

        // 注意：hijack: true 返回的是原始双向流，不使用 Docker 多路复用格式
        // 所以直接从 stream 读取，不需要使用 demuxStream

        // 发送初始命令到 shell
        // 容器的主进程是 shell，所以我们可以直接发送命令
        // 使用 cd 和 && 来在项目目录中执行命令
        const initialCmd = `${shellCommand}\n`;
        console.log('[Container Shell] Sending initial command to shell:', initialCmd.trim());
        if (stream.writable) {
            stream.write(initialCmd);
        } else {
            console.error('[Container Shell] Stream is not writable, cannot send initial command');
        }

        // 会话对象
        const session = {
            attachResult,
            stream,
            ws,
            buffer: [],
            projectPath,
            sessionId,
            userId,
            resize: async (newCols, newRows) => {
                try {
                    // container.attach() 不支持动态调整 TTY 大小
                    // TTY 大小在 attach 时确定，后续无法更改
                    console.log('[Container Shell] Resize requested (not supported with attach):', newCols, 'x', newRows);
                } catch (err) {
                    console.error('[Container Shell] Resize error:', err);
                }
            },
            write: async (inputData) => {
                try {
                    // 向 attached shell 流写入数据
                    // stream 现在应该是可写的 Duplex 流
                    if (stream && stream.writable) {
                        stream.write(inputData);
                    }
                } catch (err) {
                    console.error('[Container Shell] Write error:', err);
                }
            },
            kill: async () => {
                try {
                    // 关闭 attached 流
                    if (stream && !stream.destroyed) {
                        stream.destroy();
                    }
                } catch (err) {
                    console.error('[Container Shell] Kill error:', err);
                }
            }
        };

        // 保存会话
        ptySessionsMap.set(ptySessionKey, session);

        // 确保流在流动（某些情况下流可能被暂停）
        if (stream.isPaused()) {
            stream.resume();
        }

        // 直接从原始流读取数据（hijack 模式不使用多路复用）
        stream.on('data', (chunk) => {
            if (session.buffer.length < 5000) {
                session.buffer.push(chunk.toString());
            } else {
                session.buffer.shift();
                session.buffer.push(chunk.toString());
            }

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: chunk.toString()
                }));
            }
        });

        // 处理流结束
        stream.on('end', () => {
            console.log('[Container Shell] Process ended');
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[33mProcess exited\x1b[0m\r\n`
                }));
            }
            ptySessionsMap.delete(ptySessionKey);
        });

        stream.on('error', (err) => {
            console.error('[Container Shell] Stream error:', err);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`
                }));
            }
        });

        // 设置当前进程
        let currentSession = session;

        // 注意：我们不在这里设置 ws.on('message') 处理器
        // 而是依赖 ptySessionsMap 来让主处理器路由消息
        // 这样可以避免多个消息处理器冲突

        // 处理 WebSocket 关闭
        ws.on('close', () => {
            console.log('[Container Shell] WebSocket closed');
            if (currentSession && currentSession.kill) {
                currentSession.kill();
            }
            ptySessionsMap.delete(ptySessionKey);
        });

        // 返回会话键，以便主处理器可以引用此会话
        return ptySessionKey;

    } catch (error) {
        console.error('[Container Shell] Error:', error);
        ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
        }));
        return null;
    }
}

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
                const isContainerProject = data.isContainerProject || (CONTAINER.enabled && !projectPath.startsWith('/'));

                console.log('[Shell Debug] projectPath:', projectPath);
                console.log('[Shell Debug] sessionId:', sessionId);
                console.log('[Shell Debug] provider:', provider);
                console.log('[Shell Debug] isPlainShell:', isPlainShell);
                console.log('[Shell Debug] CONTAINER.enabled:', CONTAINER.enabled);
                console.log('[Shell Debug] projectPath.startsWith(/):', projectPath.startsWith('/'));
                console.log('[Shell Debug] data.isContainerProject:', data.isContainerProject);
                console.log('[Shell Debug] isContainerProject:', isContainerProject);

                // 容器模式：使用容器 shell 处理器
                if (isContainerProject) {
                    console.log('[INFO] Container mode: Starting shell in container for project:', projectPath);
                    // 调用容器 shell 处理器并获取会话键
                    const containerSessionKey = await handleContainerShell(ws, data, ptySessionsMap);
                    if (containerSessionKey) {
                        ptySessionKey = containerSessionKey;
                        console.log('[Shell] Container session key:', ptySessionKey);
                    }
                    return;
                }

                // 主机模式：继续使用原有的 PTY 逻辑
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
                // 首先检查是否有容器会话
                if (ptySessionKey) {
                    const session = ptySessionsMap.get(ptySessionKey);
                    console.log('[Shell] Input received, ptySessionKey:', ptySessionKey, 'session:', session ? 'found' : 'not found');
                    if (session && session.write) {
                        try {
                            await session.write(data.data);
                            console.log('[Shell] Input written to container session');
                        } catch (error) {
                            console.error('Error writing to container shell:', error);
                        }
                    } else if (shellProcess && shellProcess.write) {
                        // 回退到主机模式
                        try {
                            shellProcess.write(data.data);
                            console.log('[Shell] Input written to host shell');
                        } catch (error) {
                            console.error('Error writing to shell:', error);
                        }
                    } else {
                        console.warn('No active shell process to send input to');
                    }
                } else if (shellProcess && shellProcess.write) {
                    // 主机模式
                    try {
                        shellProcess.write(data.data);
                        console.log('[Shell] Input written to host shell (no session key)');
                    } catch (error) {
                        console.error('Error writing to shell:', error);
                    }
                } else {
                    console.warn('No active shell process to send input to (no session key or shell process)');
                }
            } else if (data.type === 'resize') {
                // 处理终端调整大小
                // 首先检查是否有容器会话
                if (ptySessionKey) {
                    const session = ptySessionsMap.get(ptySessionKey);
                    if (session && session.resize) {
                        console.log('Terminal resize requested (container):', data.cols, 'x', data.rows);
                        await session.resize(data.cols, data.rows);
                    } else if (shellProcess && shellProcess.resize) {
                        // 回退到主机模式
                        console.log('Terminal resize requested (host):', data.cols, 'x', data.rows);
                        shellProcess.resize(data.cols, data.rows);
                    }
                } else if (shellProcess && shellProcess.resize) {
                    // 主机模式
                    console.log('Terminal resize requested (host):', data.cols, 'x', data.rows);
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
                    // 容器会话有 kill 方法，主机会话有 pty.kill
                    if (session.kill) {
                        session.kill();
                    } else if (session.pty && session.pty.kill) {
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
