/**
 * 连接状态横幅
 * ============
 * WebSocket 断线且正在自动重连时，在页面顶部显示提示横幅。
 * 用于"后端重启等导致断线、客户端自动重连中"场景下给用户明确反馈，
 * 避免用户误以为应用卡死。
 */
import { useWebSocketContext } from '@/shared/contexts/WebSocketContext';

export function ConnectionBanner() {
  const { isConnected, isReconnecting } = useWebSocketContext();
  // 已连接，或还没建立过首次连接（isReconnecting 为 false）时不显示，
  // 避免首屏加载时闪一下横幅。
  if (isConnected || !isReconnecting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-1.5 px-4 shadow-md dark:bg-amber-600"
    >
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white/90" aria-hidden="true" />
      网络连接已断开，正在自动重连…
    </div>
  );
}

export default ConnectionBanner;
