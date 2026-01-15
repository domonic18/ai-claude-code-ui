/**
 * Message Render Utilities
 *
 * Utility functions for rendering chat messages.
 */

import type { ChatMessage as ChatMessageType } from '../types';

/**
 * Check if a message can be grouped with the previous message
 * @param current - Current message
 * @param previous - Previous message
 * @returns True if messages should be grouped
 */
export function shouldGroupWithPrevious(
  current: ChatMessageType,
  previous?: ChatMessageType
): boolean {
  if (!previous) return false;

  const groupableTypes = ['assistant', 'user', 'tool', 'error'];
  return (
    groupableTypes.includes(previous.type) &&
    previous.type === current.type
  );
}

/**
 * Get display name for a message type
 * @param type - Message type
 * @param provider - AI provider
 * @returns Display name
 */
export function getDisplayName(
  type: string,
  provider: string
): string {
  if (type === 'error') return 'Error';
  if (type === 'tool') return 'Tool';
  if (provider === 'cursor') return 'Cursor';
  if (provider === 'codex') return 'Codex';
  return 'Claude';
}

/**
 * Get CSS classes for message container
 * @param type - Message type
 * @param isGrouped - Whether message is grouped
 * @returns CSS class string
 */
export function getMessageContainerClasses(
  type: string,
  isGrouped: boolean
): string {
  return `chat-message ${type} ${isGrouped ? 'grouped' : ''} px-3 sm:px-0`;
}

/**
 * Get avatar background color based on message type
 * @param type - Message type
 * @returns CSS class for avatar background
 */
export function getAvatarBackgroundClass(type: string): string {
  switch (type) {
    case 'error':
      return 'bg-red-600';
    case 'tool':
      return 'bg-gray-600 dark:bg-gray-700';
    default:
      return ''; // Will use provider-specific logo
  }
}

/**
 * Get avatar content based on message type
 * @param type - Message type
 * @returns Avatar content (emoji or icon)
 */
export function getAvatarContent(type: string): string | null {
  switch (type) {
    case 'error':
      return '!';
    case 'tool':
      return '🔧';
    default:
      return null; // Will use provider logo
  }
}
