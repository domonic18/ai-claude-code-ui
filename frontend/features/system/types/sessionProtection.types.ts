/**
 * Session Protection Types
 *
 * Type definitions for session protection functionality.
 */

/**
 * Session protection state
 */
export interface SessionProtectionState {
  activeSessions: Set<string>;
  processingSessions: Set<string>;
  externalMessageUpdate: number;
}

/**
 * Session protection actions
 */
export interface SessionProtectionActions {
  markSessionAsActive: (sessionId: string) => void;
  markSessionAsInactive: (sessionId: string) => void;
  markSessionAsProcessing: (sessionId: string) => void;
  markSessionAsNotProcessing: (sessionId: string) => void;
  replaceTemporarySession: (realSessionId: string) => Promise<void>;
  clearAllActiveSessions: () => void;
  hasActiveSession: (sessionId?: string) => boolean;
  isSessionActive: (sessionId: string) => boolean;
  isSessionProcessing: (sessionId: string) => boolean;
}
