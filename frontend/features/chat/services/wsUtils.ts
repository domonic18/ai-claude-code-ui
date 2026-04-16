/**
 * WebSocket Utilities
 *
 * Shared utility functions for WebSocket message handling.
 */

import { t as translate } from '@/shared/i18n';
import { logger } from '@/shared/utils/logger';

/** Message ID counter to ensure unique IDs */
let messageIdCounter = 0;

/**
 * Generate a unique message ID
 * Uses a counter to avoid collisions when multiple messages arrive in the same millisecond
 * @param prefix - Prefix for the message ID (e.g., 'assistant', 'tool', 'error')
 */
export function generateMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++messageIdCounter}`;
}

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Safe localStorage wrapper with error handling
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      logger.warn(`${translate('websocket.error.localStorageSetFailed')}:`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      logger.warn(`${translate('websocket.error.localStorageRemoveFailed')}:`, e);
    }
  }
};
