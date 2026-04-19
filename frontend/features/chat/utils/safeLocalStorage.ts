/**
 * Safe localStorage utility to handle quota exceeded errors
 *
 * @module features/chat/utils/safeLocalStorage
 */

import { logger } from '@/shared/utils/logger';
import { MAX_STORED_MESSAGES, MIN_STORED_MESSAGES } from '../constants';

/**
 * Truncate chat messages value if it exceeds the maximum stored limit
 * @param value - JSON stringified messages array
 * @returns Truncated value or original value
 */
function truncateChatMessages(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > MAX_STORED_MESSAGES) {
      logger.warn(`Truncating chat history from ${parsed.length} to ${MAX_STORED_MESSAGES} messages`);
      return JSON.stringify(parsed.slice(-MAX_STORED_MESSAGES));
    }
  } catch (parseError) {
    logger.warn('Could not parse chat messages for truncation:', parseError);
  }
  return value;
}

/**
 * Clear old localStorage data to free up space
 */
function clearOldData(): void {
  const keys = Object.keys(localStorage);

  // Remove oldest chat data, keeping only 3 most recent
  const chatKeys = keys.filter(k => k.startsWith('chat_messages_')).sort();
  if (chatKeys.length > 3) {
    chatKeys.slice(0, chatKeys.length - 3).forEach(k => {
      localStorage.removeItem(k);
      logger.info(`Removed old chat data: ${k}`);
    });
  }

  // Clear draft inputs
  keys.filter(k => k.startsWith('draft_input_')).forEach(k => {
    localStorage.removeItem(k);
  });
}

/**
 * Try to save a minimal version of chat messages as last resort
 * @param key - localStorage key
 * @param value - Original JSON stringified value
 */
function tryMinimalSave(key: string, value: string): void {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > MIN_STORED_MESSAGES) {
      const minimal = parsed.slice(-MIN_STORED_MESSAGES);
      localStorage.setItem(key, JSON.stringify(minimal));
      logger.warn(`Saved only last ${MIN_STORED_MESSAGES} messages due to quota constraints`);
    }
  } catch (finalError) {
    logger.error('Final save attempt failed:', finalError);
  }
}

/**
 * Safe localStorage operations with quota handling
 */
export const safeLocalStorage = {
  /**
   * Set item in localStorage with quota handling
   */
  setItem: (key: string, value: string) => {
    try {
      if (key.startsWith('chat_messages_') && typeof value === 'string') {
        value = truncateChatMessages(value);
      }

      localStorage.setItem(key, value);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'QuotaExceededError')) {
        logger.error('localStorage error:', error);
        return;
      }

      logger.warn('localStorage quota exceeded, clearing old data');
      clearOldData();

      try {
        localStorage.setItem(key, value);
      } catch (retryError) {
        logger.error('Failed to save to localStorage even after cleanup:', retryError);
        if (key.startsWith('chat_messages_') && typeof value === 'string') {
          tryMinimalSave(key, value);
        }
      }
    }
  },

  /**
   * Get item from localStorage
   */
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      logger.error('localStorage getItem error:', error);
      return null;
    }
  },

  /**
   * Remove item from localStorage
   */
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logger.error('localStorage removeItem error:', error);
    }
  }
};
