/**
 * Safe localStorage utility to handle quota exceeded errors
 *
 * @module features/chat/utils/safeLocalStorage
 */

import { logger } from '@/shared/utils/logger';
import { MAX_STORED_MESSAGES, MIN_STORED_MESSAGES } from '../constants';

/**
 * Safe localStorage operations with quota handling
 */
export const safeLocalStorage = {
  /**
   * Set item in localStorage with quota handling
   */
  setItem: (key: string, value: string) => {
    try {
      // For chat messages, implement size limits
      if (key.startsWith('chat_messages_') && typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          // Limit to last MAX_STORED_MESSAGES to prevent storage bloat
          if (Array.isArray(parsed) && parsed.length > MAX_STORED_MESSAGES) {
            logger.warn(`Truncating chat history for ${key} from ${parsed.length} to ${MAX_STORED_MESSAGES} messages`);
            const truncated = parsed.slice(-MAX_STORED_MESSAGES);
            value = JSON.stringify(truncated);
          }
        } catch (parseError) {
          logger.warn('Could not parse chat messages for truncation:', parseError);
        }
      }

      localStorage.setItem(key, value);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        logger.warn('localStorage quota exceeded, clearing old data');
        // Clear old chat messages to free up space
        const keys = Object.keys(localStorage);
        const chatKeys = keys.filter(k => k.startsWith('chat_messages_')).sort();

        // Remove oldest chat data first, keeping only the 3 most recent projects
        if (chatKeys.length > 3) {
          chatKeys.slice(0, chatKeys.length - 3).forEach(k => {
            localStorage.removeItem(k);
            logger.info(`Removed old chat data: ${k}`);
          });
        }

        // If still failing, clear draft inputs too
        const draftKeys = keys.filter(k => k.startsWith('draft_input_'));
        draftKeys.forEach(k => {
          localStorage.removeItem(k);
        });

        // Try again with reduced data
        try {
          localStorage.setItem(key, value);
        } catch (retryError) {
          logger.error('Failed to save to localStorage even after cleanup:', retryError);
          // Last resort: Try to save just the last MIN_STORED_MESSAGES
          if (key.startsWith('chat_messages_') && typeof value === 'string') {
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
        }
      } else {
        logger.error('localStorage error:', error);
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
