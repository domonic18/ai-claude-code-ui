/**
 * Chat Constants
 *
 * Constant values for chat functionality.
 */

/**
 * Maximum file size for uploads (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum number of files that can be attached at once
 */
export const MAX_FILES = 10;

/**
 * Allowed file types for upload
 */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'text/javascript',
  'text/typescript',
  'text/css',
  'text/html',
  'application/zip',
];

/**
 * LocalStorage keys
 */
export const STORAGE_KEYS = {
  /** Chat messages for a session */
  MESSAGES: (sessionId: string) => `chat_messages_${sessionId}`,
  /** Draft input for a session */
  DRAFT_INPUT: (sessionId: string) => `draft_input_${sessionId}`,
  /** Chat settings */
  SETTINGS: 'chat_settings',
  /** Expanded tools setting */
  AUTO_EXPAND_TOOLS: 'auto_expand_tools',
  /** Show raw parameters */
  SHOW_RAW_PARAMETERS: 'show_raw_parameters',
  /** Show thinking process */
  SHOW_THINKING: 'show_thinking',
} as const;

/**
 * Default chat settings
 */
export const DEFAULT_CHAT_SETTINGS = {
  /** Automatically expand tool results */
  autoExpandTools: false,
  /** Show raw parameters in tool calls */
  showRawParameters: false,
  /** Show thinking process */
  showThinking: true,
  /** Auto-scroll to bottom on new messages */
  autoScrollToBottom: true,
  /** Send message with Ctrl+Enter */
  sendByCtrlEnter: false,
} as const;

/**
 * Message grouping threshold in milliseconds
 * Messages within this timeframe are grouped together
 */
export const MESSAGE_GROUP_THRESHOLD = 60000; // 1 minute

/**
 * Maximum messages to store in localStorage
 */
export const MAX_STORED_MESSAGES = 50;

/**
 * Minimum messages to keep when clearing storage
 */
export const MIN_STORED_MESSAGES = 10;

/**
 * Tool names that should be minimized by default
 */
export const MINIMIZED_TOOLS = [
  'Grep',
  'Glob',
  'Read',
] as const;

/**
 * Tool names that should never be minimized
 */
export const ALWAYS_EXPAND_TOOLS = [
  'Bash',
  'Task',
  'Write',
  'Edit',
] as const;

/**
 * Streaming update interval in milliseconds
 */
export const STREAMING_UPDATE_INTERVAL = 100;

/**
 * Scroll behavior options
 */
export const SCROLL_BEHAVIOR = {
  /** Smooth scroll animation */
  SMOOTH: 'smooth' as const,
  /** Instant scroll */
  AUTO: 'auto' as const,
} as const;

/**
 * Chat message status
 */
export const MESSAGE_STATUS = {
  /** Message is being sent */
  SENDING: 'sending' as const,
  /** Message was sent successfully */
  SENT: 'sent' as const,
  /** Message failed to send */
  FAILED: 'failed' as const,
  /** Message is streaming */
  STREAMING: 'streaming' as const,
} as const;

/**
 * Image preview settings
 */
export const IMAGE_PREVIEW = {
  /** Maximum image width for preview */
  MAX_WIDTH: 800,
  /** Maximum image height for preview */
  MAX_HEIGHT: 600,
  /** Quality for image compression (0-1) */
  QUALITY: 0.8,
} as const;
