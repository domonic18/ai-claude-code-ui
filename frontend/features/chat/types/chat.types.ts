/**
 * Chat Types
 *
 * Type definitions for chat-related data structures and interfaces.
 */

/**
 * Message types in the chat system
 */
export type MessageType = 'user' | 'assistant' | 'tool' | 'error' | 'system';

/**
 * Chat message structure
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Type of message */
  type: MessageType;
  /** Message content (text, markdown, etc.) */
  content: string;
  /** Timestamp when message was created */
  timestamp: number | Date;
  /** Whether this is a tool use message */
  isToolUse?: boolean;
  /** Tool name if this is a tool message */
  toolName?: string;
  /** Tool input parameters */
  toolInput?: string;
  /** Tool result/output */
  toolResult?: string | {
    content: string;
    isError?: boolean;
    toolUseResult?: any;
  };
  /** Tool ID for tracking */
  toolId?: string;
  /** Whether tool result is currently streamed */
  toolResultIsStreamed?: boolean;
  /** Attached images */
  images?: Array<{
    name: string;
    data: string;
    type: string;
  }>;
  /** File attachments */
  files?: Array<FileAttachment>;
  /** Thinking process content */
  thinking?: string;
  /** Whether this is a thinking message */
  isThinking?: boolean;
  /** Whether this message is currently streaming */
  isStreaming?: boolean;
  /** Whether this is an interactive prompt */
  isInteractivePrompt?: boolean;
  /** Raw parameters for display */
  rawParameters?: any;
  /** Tool call ID for matching results */
  toolCallId?: string;
  /** Tool error status (deprecated - use toolResult.isError instead) */
  toolError?: boolean;
  /** Tool result timestamp */
  toolResultTimestamp?: Date;
  /** Whether to minimize tool display */
  minimizeTool?: boolean;
}

/**
 * File attachment structure
 */
export interface FileAttachment {
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** File MIME type */
  type: string;
  /** File data (base64 or reference) */
  data?: string;
  /** Upload progress (0-100) */
  uploadProgress?: number;
  /** Upload error message */
  error?: string;
}

/**
 * Chat state structure
 */
export interface ChatState {
  /** All messages in the chat */
  messages: ChatMessage[];
  /** Whether a message is currently being sent */
  isSending: boolean;
  /** Whether waiting for response */
  isWaiting: boolean;
  /** Current streaming message content */
  streamingContent: string;
  /** Current streaming thinking content */
  streamingThinking: string;
}

/**
 * Chat input state
 */
export interface ChatInputState {
  /** Current input text */
  text: string;
  /** Attached files */
  files: FileAttachment[];
  /** Whether input is focused */
  isFocused: boolean;
}

/**
 * Chat actions for manipulating state
 */
export interface ChatActions {
  /** Add a message to the chat */
  addMessage: (message: ChatMessage) => void;
  /** Remove a message by ID */
  removeMessage: (messageId: string) => void;
  /** Update a message */
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  /** Clear all messages */
  clearMessages: () => void;
  /** Set sending state */
  setSending: (isSending: boolean) => void;
  /** Set waiting state */
  setWaiting: (isWaiting: boolean) => void;
  /** Set streaming content */
  setStreamingContent: (content: string) => void;
  /** Set streaming thinking */
  setStreamingThinking: (thinking: string) => void;
}

/**
 * Chat context value type
 */
export interface ChatContextValue extends ChatState, ChatActions {
  /** Send a message */
  sendMessage: (content: string, files?: File[]) => Promise<void>;
  /** Retry last message */
  retryMessage: () => Promise<void>;
}

/**
 * Message component props
 */
export interface ChatMessageProps {
  /** Message data */
  message: ChatMessage;
  /** Message index in list */
  index: number;
  /** Previous message for grouping */
  prevMessage?: ChatMessage;
  /** Handler for opening files with optional diff data */
  onFileOpen?: (filePath: string, diffData?: any) => void;
  /** Handler for showing settings */
  onShowSettings?: () => void;
  /** Whether to auto expand tools */
  autoExpandTools?: boolean;
  /** Whether to show raw parameters */
  showRawParameters?: boolean;
  /** Whether to show thinking process */
  showThinking?: boolean;
  /** Selected project context */
  selectedProject?: string;
}

/**
 * Chat input component props
 */
export interface ChatInputProps {
  /** Current input value */
  value: string;
  /** Input change handler */
  onChange: (value: string, cursorPosition: number) => void;
  /** Send message handler */
  onSend: () => void;
  /** File attachments */
  files: FileAttachment[];
  /** Add file handler */
  onAddFile: (file: FileAttachment) => void;
  /** Remove file handler */
  onRemoveFile: (fileName: string) => void;
  /** Whether disabled */
  disabled?: boolean;
  /** Whether to send by Ctrl+Enter */
  sendByCtrlEnter?: boolean;
  /** Focus change handler */
  onFocusChange?: (isFocused: boolean) => void;
  /** Maximum file size in bytes */
  maxFileSize?: number;
}

/**
 * Markdown renderer props
 */
export interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string;
  /** Additional CSS class name */
  className?: string;
  /** Whether to enable math rendering */
  enableMath?: boolean;
  /** Custom components for markdown elements */
  components?: Record<string, React.ComponentType<any>>;
}

/**
 * File upload handler props
 */
export interface FileUploadHandlerProps {
  /** Currently attached files */
  files: FileAttachment[];
  /** On file added callback */
  onFileAdd: (file: FileAttachment) => void;
  /** On file removed callback */
  onFileRemove: (fileName: string) => void;
  /** Maximum file size */
  maxFileSize?: number;
  /** Allowed file types */
  allowedTypes?: string[];
}

/**
 * Streaming indicator props
 */
export interface StreamingIndicatorProps {
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Streaming content so far */
  content: string;
  /** Thinking content */
  thinking?: string;
}
