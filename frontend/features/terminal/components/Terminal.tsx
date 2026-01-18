import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { ShellProps } from '../types/terminal.types';

const xtermStyles = `
  .xterm .xterm-screen {
    outline: none !important;
  }
  .xterm:focus .xterm-screen {
    outline: none !important;
  }
  .xterm-screen:focus {
    outline: none !important;
  }
  .xterm {
    z-index: 1;
  }
  .xterm-link-layer {
    z-index: 2;
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = xtermStyles;
  document.head.appendChild(styleSheet);
}

function Shell({
  selectedProject,
  selectedSession,
  initialCommand,
  isPlainShell = false,
  onProcessComplete,
  minimal = false,
  autoConnect = false,
  isActive = false
}: ShellProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState<boolean>(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [userDisconnected, setUserDisconnected] = useState<boolean>(false);

  const selectedProjectRef = useRef(selectedProject);
  const selectedSessionRef = useRef(selectedSession);
  const initialCommandRef = useRef(initialCommand);
  const isPlainShellRef = useRef(isPlainShell);
  const onProcessCompleteRef = useRef(onProcessComplete);
  const isConnectingRef = useRef(false); // 使用 ref 跟踪连接状态，避免状态更新延迟问题

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
    selectedSessionRef.current = selectedSession;
    initialCommandRef.current = initialCommand;
    isPlainShellRef.current = isPlainShell;
    onProcessCompleteRef.current = onProcessComplete;
  });

  const connectWebSocket = useCallback(async () => {
    if (isConnectingRef.current || isConnected) {
      return;
    }

    // 立即设置连接标志
    isConnectingRef.current = true;
    setIsConnecting(true);

    try {
      const isPlatform = import.meta.env.VITE_IS_PLATFORM === 'true';
      let wsUrl;

      if (isPlatform) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/shell`;
      } else {
        // 获取 WebSocket token（从 cookie 复制）
        let token;
        try {
          console.log('[Shell] Fetching ws-token from /api/auth/ws-token');
          const response = await fetch('/api/auth/ws-token', {
            credentials: 'include' // 发送 cookie
          });
          console.log('[Shell] ws-token response status:', response.status);
          if (response.ok) {
            const data = await response.json();
            // 后端返回 {success: true, data: {token: "..."}}
            token = data.data?.token;
            console.log('[Shell] Got token, length:', token?.length);
          } else {
            console.log('[Shell] ws-token response not ok:', response.status);
            const errorText = await response.text();
            console.log('[Shell] Error response:', errorText);
          }
        } catch (error) {
          console.error('[Shell] Error fetching ws-token:', error);
          setIsConnecting(false);
          isConnectingRef.current = false;
          return;
        }

        if (!token) {
          console.log('[Shell] No token available, aborting connection');
          setIsConnecting(false);
          isConnectingRef.current = false;
          return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/shell?token=${encodeURIComponent(token)}`;
        console.log('[Shell] Non-platform mode, wsUrl:', wsUrl.substring(0, 50) + '...');
      }

      console.log('[Shell] Creating WebSocket with URL:', wsUrl.substring(0, 80) + '...');
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('[Shell] WebSocket opened');
        setIsConnected(true);
        setIsConnecting(false);
        isConnectingRef.current = false;

        setTimeout(() => {
          if (fitAddon.current && terminal.current && ws.current) {
            fitAddon.current.fit();

            ws.current.send(JSON.stringify({
              type: 'init',
              projectPath: selectedProjectRef.current.fullPath || selectedProjectRef.current.path,
              sessionId: isPlainShellRef.current ? null : selectedSessionRef.current?.id,
              hasSession: isPlainShellRef.current ? false : !!selectedSessionRef.current,
              provider: isPlainShellRef.current ? 'plain-shell' : (selectedSessionRef.current?.__provider || 'claude'),
              cols: terminal.current.cols,
              rows: terminal.current.rows,
              initialCommand: initialCommandRef.current,
              isPlainShell: isPlainShellRef.current
            }));
          }
        }, 100);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'output') {
            let output = data.data;

            if (isPlainShellRef.current && onProcessCompleteRef.current) {
              const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
              if (cleanOutput.includes('Process exited with code 0')) {
                onProcessCompleteRef.current(0);
              } else if (cleanOutput.match(/Process exited with code (\d+)/)) {
                const exitCode = parseInt(cleanOutput.match(/Process exited with code (\d+)/)[1]);
                if (exitCode !== 0) {
                  onProcessCompleteRef.current(exitCode);
                }
              }
            }

            if (terminal.current) {
              terminal.current.write(output);
            }
          } else if (data.type === 'url_open') {
            window.open(data.url, '_blank');
          }
        } catch (error) {
          console.error('[Shell] Error handling WebSocket message:', error, event.data);
        }
      };

      ws.current.onclose = (event) => {
        console.log('[Shell] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;

        if (terminal.current) {
          terminal.current.clear();
          terminal.current.write('\x1b[2J\x1b[H');
        }
      };

      ws.current.onerror = (error) => {
        console.error('[Shell] WebSocket error:', error);
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
      };
    } catch (error) {
      setIsConnected(false);
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [isConnected]);

  const connectToShell = useCallback(() => {
    // 使用 ref 检查，避免状态更新延迟
    if (!isInitialized || isConnected || isConnectingRef.current) {
      return;
    }
    // 清除用户主动断开的标志
    setUserDisconnected(false);
    connectWebSocket();
  }, [isInitialized, isConnected, connectWebSocket]);

  const disconnectFromShell = useCallback(() => {
    // 标记用户主动断开
    setUserDisconnected(true);
    // 重置连接状态 ref
    isConnectingRef.current = false;

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[2J\x1b[H');
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sessionDisplayName = useMemo(() => {
    if (!selectedSession) return null;
    return selectedSession.__provider === 'cursor'
      ? (selectedSession.name || 'Untitled Session')
      : (selectedSession.summary || 'New Session');
  }, [selectedSession]);

  const sessionDisplayNameShort = useMemo(() => {
    if (!sessionDisplayName) return null;
    return sessionDisplayName.slice(0, 30);
  }, [sessionDisplayName]);

  const sessionDisplayNameLong = useMemo(() => {
    if (!sessionDisplayName) return null;
    return sessionDisplayName.slice(0, 50);
  }, [sessionDisplayName]);

  const restartShell = () => {
    setIsRestarting(true);
    // 清除用户主动断开的标志
    setUserDisconnected(false);
    // 重置连接状态 ref
    isConnectingRef.current = false;

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    if (terminal.current) {
      terminal.current.dispose();
      terminal.current = null;
      fitAddon.current = null;
    }

    setIsConnected(false);
    setIsInitialized(false);

    setTimeout(() => {
      setIsRestarting(false);
    }, 200);
  };

  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;

    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      disconnectFromShell();
    }

    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized, disconnectFromShell]);

  useEffect(() => {
    if (!terminalRef.current || !selectedProject || isRestarting || terminal.current) {
      return;
    }


    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true,
      allowTransparency: false,
      convertEol: true,
      scrollback: 10000,
      tabStopWidth: 4,
      windowsMode: false,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: false,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#1e1e1e',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      } as any
    });

    fitAddon.current = new FitAddon();
    const webglAddon = new WebglAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(webLinksAddon);
    // Note: ClipboardAddon removed - we handle clipboard operations manually in attachCustomKeyEventHandler

    try {
      terminal.current.loadAddon(webglAddon);
    } catch (error) {
      console.warn('[Shell] WebGL renderer unavailable, using Canvas fallback');
    }

    terminal.current.open(terminalRef.current);

    terminal.current.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.current.hasSelection()) {
        document.execCommand('copy');
        return false;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'input',
              data: text
            }));
          }
        }).catch(() => {});
        return false;
      }

      return true;
    });

    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        }
      }
    }, 100);

    setIsInitialized(true);
    terminal.current.onData((data) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'input',
          data: data
        }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && terminal.current) {
        setTimeout(() => {
          fitAddon.current.fit();
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'resize',
              cols: terminal.current.cols,
              rows: terminal.current.rows
            }));
          }
        }, 50);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();

      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
        ws.current.close();
      }
      ws.current = null;

      if (terminal.current) {
        terminal.current.dispose();
        terminal.current = null;
      }
    };
  }, [selectedProject?.path || selectedProject?.fullPath, isRestarting]);

  useEffect(() => {
    // 如果用户主动断开了连接，不要自动重连
    if (userDisconnected) return;

    if (!autoConnect || !isInitialized || isConnecting || isConnected) return;
    connectToShell();
  }, [autoConnect, isInitialized, isConnecting, isConnected, connectToShell, userDisconnected]);

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Select a Project</h3>
          <p>Choose a project to open an interactive shell in that directory</p>
        </div>
      </div>
    );
  }

  if (minimal) {
    return (
      <div className="h-full w-full bg-gray-900">
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 w-full">
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {selectedSession && (
              <span className="text-xs text-blue-300">
                ({sessionDisplayNameShort}...)
              </span>
            )}
            {!selectedSession && (
              <span className="text-xs text-gray-400">(New Session)</span>
            )}
            {!isInitialized && (
              <span className="text-xs text-yellow-400">(Initializing...)</span>
            )}
            {isRestarting && (
              <span className="text-xs text-blue-400">(Restarting...)</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {isConnected && (
              <button
                onClick={disconnectFromShell}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1"
                title="Disconnect from shell"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Disconnect</span>
              </button>
            )}

            <button
              onClick={restartShell}
              disabled={isRestarting || isConnected}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              title="Restart Shell (disconnect first)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Restart</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 overflow-hidden relative">
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />

        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-50">
            <div className="text-white">Loading terminal...</div>
          </div>
        )}

        {isInitialized && !isConnected && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4 z-40">
            <div className="text-center max-w-sm w-full">
              <button
                onClick={connectToShell}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-base font-medium w-full sm:w-auto"
                title="Connect to shell"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Continue in Shell</span>
              </button>
              <p className="text-gray-400 text-sm mt-3 px-2">
                {isPlainShell ?
                  `Run ${initialCommand || 'command'} in ${selectedProject.displayName}` :
                  selectedSession ?
                    `Resume session: ${sessionDisplayNameLong}...` :
                    'Start a new Claude session'
                }
              </p>
            </div>
          </div>
        )}

        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
            <div className="text-center max-w-sm w-full">
              <div className="flex items-center justify-center space-x-3 text-yellow-400">
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
                <span className="text-base font-medium">Connecting to shell...</span>
              </div>
              <p className="text-gray-400 text-sm mt-3 px-2">
                {isPlainShell ?
                  `Running ${initialCommand || 'command'} in ${selectedProject.displayName}` :
                  `Starting Claude CLI in ${selectedProject.displayName}`
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Shell;
export { Shell as Terminal, Shell };