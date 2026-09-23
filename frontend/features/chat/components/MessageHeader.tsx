/**
 * MessageHeader Component
 *
 * Renders the header for AI/Tool/Error messages with avatar and display name.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClaudeLogo, CursorLogo, CodexLogo } from '@/shared/assets/icons';
import { getAvatarBackgroundClass, getAvatarContent } from '../utils/messageRenderUtils';

export interface MessageHeaderProps {
  type: 'assistant' | 'tool' | 'error';
  provider?: string;
  displayName?: string;
  isGrouped: boolean;
  /** 本轮整轮耗时（毫秒），存在时展示在名称旁（如 "3.2s"） */
  durationMs?: number;
  onShowSettings?: () => void;
}

/**
 * 格式化耗时展示：≥60s 用分秒（1m 5s），≥1s 用一位小数秒（3.2s），否则毫秒（850ms）
 * @param durationMs - 耗时（毫秒）
 * @returns 格式化后的耗时文本
 */
function formatDuration(durationMs: number): string {
  if (durationMs >= 60_000) {
    const minutes = Math.floor(durationMs / 60_000);
    const seconds = Math.round((durationMs % 60_000) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${Math.round(durationMs)}ms`;
}

/**
 * MessageHeader Component
 *
 * Displays avatar, display name, and optional settings button for messages.
 */
export function MessageHeader({
  type,
  provider = 'claude',
  displayName,
  isGrouped,
  durationMs,
  onShowSettings,
}: MessageHeaderProps) {
  const { t, i18n } = useTranslation();

  // If grouped, don't show header
  if (isGrouped) return null;

  const avatarBg = getAvatarBackgroundClass(type);
  const avatarContent = getAvatarContent(type);

  // Use Chinese name for Claude when in Chinese locale
  const getClaudeDisplayName = () => {
    if (type === 'assistant' && provider === 'claude') {
      return i18n.language === 'zh' ? t('agent.claudeChinese') : t('agent.claude');
    }
    return t('agent.claude');
  };

  const displayLabel = displayName || (type === 'tool' ? t('chat.tool') : type === 'error' ? t('chat.error') : getClaudeDisplayName());

  return (
    <div className="flex items-center space-x-3 mb-2">
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 ${avatarBg}`}>
        {avatarContent || (
          <div className="w-full h-full p-1">
            {provider === 'cursor' ? (
              <CursorLogo className="w-full h-full" />
            ) : provider === 'codex' ? (
              <CodexLogo className="w-full h-full" />
            ) : (
              <ClaudeLogo className="w-full h-full" />
            )}
          </div>
        )}
      </div>

      {/* Display name */}
      <div className="text-sm font-medium text-foreground">
        {displayLabel}
      </div>

      {/* 整轮耗时：仅 assistant 消息且有值时展示，次要视觉不抢内容焦点 */}
      {type === 'assistant' && typeof durationMs === 'number' && durationMs >= 0 && (
        <span
          className="text-xs text-muted-foreground flex-shrink-0"
          title={t('chat.durationTooltip')}
        >
          {formatDuration(durationMs)}
        </span>
      )}
    </div>
  );
}

export default MessageHeader;
