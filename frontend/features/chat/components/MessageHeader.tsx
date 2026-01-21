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
  onShowSettings?: () => void;
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
      <div className="text-sm font-medium text-gray-900 dark:text-white">
        {displayLabel}
      </div>
    </div>
  );
}

export default MessageHeader;
