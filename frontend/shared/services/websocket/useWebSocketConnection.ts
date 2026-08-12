import { logger } from '@/shared/utils/logger';

// ── 心跳与重连参数 ──
// 浏览器无法用协议层 ping 主动探活（JS 拿不到 ws.ping），必须用应用层 ping/pong。
/** 心跳间隔：每 30s 发一次 ping（< nginx 默认 60s idle，兼做双向保活） */
const HEARTBEAT_INTERVAL_MS = 30000;
/** 单次 pong 等待超时：ping 后 15s 内没收到 pong 计一次 miss */
const PONG_TIMEOUT_MS = 15000;
/** 连续 miss 上限：达到后判定连接已死，强制关闭并重连（容忍偶发网络抖动） */
const MISSED_PONGS_LIMIT = 2;
/** 重连初始退避（ms），随尝试次数指数增长 */
const RECONNECT_BASE_MS = 1000;
/** 重连退避上限（ms） */
const RECONNECT_MAX_MS = 30000;

export interface WebSocketConnectionRefs {
  wsRef: React.MutableRefObject<WebSocket | null>;
  reconnectTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  isConnectingRef: React.MutableRefObject<boolean>;
  isUnmountedRef: React.MutableRefObject<boolean>;
  isEnabledRef: React.MutableRefObject<boolean>;
  /** 心跳定时器（每 HEARTBEAT_INTERVAL_MS 发一次 ping） */
  heartbeatTimerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  /** 单次 ping 后等待 pong 的定时器 */
  pongTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  /** 连续未收到 pong 的次数 */
  missedPongsRef: React.MutableRefObject<number>;
  /** 重连尝试次数（用于指数退避；成功连上后归零） */
  reconnectAttemptRef: React.MutableRefObject<number>;
}

export interface WebSocketConnectionCallbacks {
  onConnected: (ws: WebSocket) => void;
  onMessage: (data: any) => void;
  onDisconnected: () => void;
}

/**
 * 清理心跳相关定时器（不触碰重连定时器）。
 * 连接关闭/重连时调用，避免上一条连接的心跳残留。
 */
function clearHeartbeat(refs: WebSocketConnectionRefs): void {
  if (refs.heartbeatTimerRef.current) {
    clearInterval(refs.heartbeatTimerRef.current);
    refs.heartbeatTimerRef.current = null;
  }
  if (refs.pongTimerRef.current) {
    clearTimeout(refs.pongTimerRef.current);
    refs.pongTimerRef.current = null;
  }
  refs.missedPongsRef.current = 0;
}

/**
 * 清理所有连接相关定时器（含重连定时器）。组件卸载时调用。
 */
export function clearConnectionTimers(refs: WebSocketConnectionRefs): void {
  if (refs.reconnectTimeoutRef.current) {
    clearTimeout(refs.reconnectTimeoutRef.current);
    refs.reconnectTimeoutRef.current = null;
  }
  clearHeartbeat(refs);
}

/**
 * 启动心跳：定时发 ping，pong 超时累计 miss，达上限强制关闭（→ onclose → 退避重连）。
 * 用于主动探测"半开"死连接（如后端重启后客户端 socket 假活）。
 */
function startHeartbeat(websocket: WebSocket, refs: WebSocketConnectionRefs): void {
  clearHeartbeat(refs);
  refs.heartbeatTimerRef.current = setInterval(() => {
    // 连接已不 OPEN（onclose 会清心跳），本轮跳过
    if (websocket.readyState !== WebSocket.OPEN) return;
    // 上一轮 pong 等待仍在则先清掉，避免定时器重叠
    if (refs.pongTimerRef.current) {
      clearTimeout(refs.pongTimerRef.current);
      refs.pongTimerRef.current = null;
    }
    try {
      websocket.send(JSON.stringify({ type: 'ping' }));
    } catch (e) {
      logger.warn('[WebSocket] heartbeat send failed:', e);
    }
    refs.pongTimerRef.current = setTimeout(() => {
      refs.missedPongsRef.current += 1;
      logger.warn({ missed: refs.missedPongsRef.current }, '[WebSocket] heartbeat: pong timeout');
      if (refs.missedPongsRef.current >= MISSED_PONGS_LIMIT) {
        logger.warn('[WebSocket] heartbeat: dead connection, forcing reconnect');
        // 用 4000 标识心跳超时关闭；触发 onclose 走退避重连
        try {
          websocket.close(4000, 'heartbeat timeout');
        } catch {
          /* ignore close errors */
        }
      }
    }, PONG_TIMEOUT_MS);
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * 计算指数退避延迟（含随机抖动，防多客户端同时重连"惊群"）。
 */
function getReconnectDelay(attempt: number): number {
  const base = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
  const jitter = Math.random() * 500; // 0~500ms
  return base + jitter;
}

/**
 * 幂等调度重连：已有重连定时器/正在连接/连接仍 OPEN 时不重复调度。
 * onclose 与 onerror 共用，避免双重调度。
 */
function scheduleReconnect(refs: WebSocketConnectionRefs, callbacks: WebSocketConnectionCallbacks): void {
  if (!refs.isEnabledRef.current || refs.isUnmountedRef.current) return;
  if (refs.reconnectTimeoutRef.current || refs.isConnectingRef.current) return;
  if (refs.wsRef.current && refs.wsRef.current.readyState === WebSocket.OPEN) return;

  const attempt = refs.reconnectAttemptRef.current;
  refs.reconnectAttemptRef.current += 1;
  const delay = getReconnectDelay(attempt);
  logger.info({ attempt, delay: Math.round(delay) }, '[WebSocket] scheduling reconnect');
  refs.reconnectTimeoutRef.current = setTimeout(() => {
    refs.reconnectTimeoutRef.current = null;
    connect(refs, callbacks);
  }, delay);
}

/**
 * Constructs WebSocket URL based on environment mode
 * @returns WebSocket URL with authentication token if needed
 */
async function buildWebSocketUrl(): Promise<string> {
  const isPlatform = import.meta.env.VITE_IS_PLATFORM === 'true';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  if (isPlatform) {
    // Platform mode: Use same domain as the page (goes through proxy)
    return `${protocol}//${window.location.host}/ws`;
  }

  // OSS mode: Get token from server for WebSocket authentication
  try {
    const response = await fetch('/api/auth/ws-token', {
      credentials: 'include' // Send cookie
    });

    if (!response.ok) {
      logger.warn('[WebSocket] Failed to get ws-token:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const token = data.data?.token;

    if (!token) {
      logger.warn('[WebSocket] No token received from server');
      throw new Error('No token received');
    }

    return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
  } catch (error) {
    // 重连重试期间后端短暂下线会导致 fetch 抛 Failed to fetch，属预期、会自动重试，
    // 不计 ERROR（避免控制台一片红）。真正异常由 onerror/onclose 兜底。
    logger.debug('[WebSocket] Error fetching ws-token:', error);
    throw error;
  }
}

/**
 * Sets up WebSocket event handlers
 */
function setupWebSocketHandlers(
  websocket: WebSocket,
  refs: WebSocketConnectionRefs,
  callbacks: WebSocketConnectionCallbacks
): void {
  websocket.onopen = () => {
    logger.info('[WebSocket] Connected successfully');
    refs.reconnectAttemptRef.current = 0; // 成功连上，重置退避计数
    callbacks.onConnected(websocket);
    refs.isConnectingRef.current = false;
    startHeartbeat(websocket, refs);
  };

  websocket.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      // 心跳 pong：清等待、重置 miss，不交给业务层
      if (data.type === 'pong') {
        if (refs.pongTimerRef.current) {
          clearTimeout(refs.pongTimerRef.current);
          refs.pongTimerRef.current = null;
        }
        refs.missedPongsRef.current = 0;
        return;
      }
      callbacks.onMessage(data);
    } catch (error) {
      logger.error('[WebSocket] Error parsing message:', error);
    }
  };

  websocket.onclose = (event: CloseEvent) => {
    logger.info('[WebSocket] Disconnected, code:', event.code, 'reason:', event.reason);
    clearHeartbeat(refs);
    callbacks.onDisconnected();
    refs.isConnectingRef.current = false;

    // 非正常关闭（含心跳超时 4000）→ 幂等退避重连
    if (event.code !== 1000 && refs.isEnabledRef.current && !refs.isUnmountedRef.current) {
      scheduleReconnect(refs, callbacks);
    }
  };

  websocket.onerror = (error: Event) => {
    logger.error('[WebSocket] Error:', error);
    refs.isConnectingRef.current = false;
    // onerror 通常后随 onclose（由 onclose 触发重连）；这里兜底罕见的"只 error 不 close"。
    // scheduleReconnect 幂等，不会与 onclose 双重调度。
    scheduleReconnect(refs, callbacks);
  };
}

/**
 * Establishes WebSocket connection with automatic reconnection
 */
export function connect(
  refs: WebSocketConnectionRefs,
  callbacks: WebSocketConnectionCallbacks
): void {
  // Prevent duplicate connections
  if (refs.isConnectingRef.current || refs.wsRef.current?.readyState === WebSocket.OPEN) {
    return;
  }

  // Don't connect if not enabled or if component is unmounted
  if (!refs.isEnabledRef.current || refs.isUnmountedRef.current) {
    return;
  }

  refs.isConnectingRef.current = true;

  // Clear previous connections & stale heartbeat
  if (refs.wsRef.current) {
    refs.wsRef.current.close();
    refs.wsRef.current = null;
  }
  if (refs.reconnectTimeoutRef.current) {
    clearTimeout(refs.reconnectTimeoutRef.current);
    refs.reconnectTimeoutRef.current = null;
  }
  clearHeartbeat(refs);

  buildWebSocketUrl()
    .then((wsUrl) => {
      // Guard: abort if unmounted or disabled during async URL fetch
      if (refs.isUnmountedRef.current || !refs.isEnabledRef.current) {
        refs.isConnectingRef.current = false;
        return;
      }

      logger.info('[WebSocket] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=***'));

      const websocket = new WebSocket(wsUrl);
      // Store immediately so cleanup can close it if component unmounts
      // before onopen fires
      refs.wsRef.current = websocket;
      setupWebSocketHandlers(websocket, refs, callbacks);
    })
    .catch((error) => {
      // URL 获取/建连失败（如后端短暂下线导致 fetch ws-token 被拒）也必须继续重连，
      // 否则一次失败就永久卡死、横幅不消失。scheduleReconnect 幂等 + 指数退避，安全。
      // 重试期间属预期失败，用 debug 不污染控制台。
      logger.debug('[WebSocket] Error creating connection:', error);
      refs.isConnectingRef.current = false;
      scheduleReconnect(refs, callbacks);
    });
}
