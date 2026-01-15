/**
 * Chat Components Index
 *
 * Export all chat-related components.
 */

export { default as ChatInterface } from './ChatInterface';
export { default as ChatMessageList } from './ChatMessageList';
export { default as ChatInput } from './ChatInput';
export { default as MarkdownRenderer } from './MarkdownRenderer';
export { default as StreamingIndicator, ThinkingProcess } from './StreamingIndicator';
export { CommandAutocomplete } from './CommandAutocomplete';
export { FileReferenceMenu } from './FileReferenceMenu';
export { TokenDisplay } from './TokenDisplay';
export { ModelSelector } from './ModelSelector';
export { FileAttachmentsPreview } from './FileAttachmentsPreview';
export { ChatToolbar } from './ChatToolbar';

// Refactored modular components
export { CollapsiblePanel } from './CollapsiblePanel';
export { DiffViewer } from './DiffViewer';
export { UserMessage } from './UserMessage';
export { MessageHeader } from './MessageHeader';
export { AssistantMessage } from './AssistantMessage';
export { ToolInputRenderer } from './ToolInputRenderer';
export { ToolResultRenderer } from './ToolResultRenderer';
export { SimplifiedToolIndicator } from './SimplifiedToolIndicator';
export { FullToolMessage } from './FullToolMessage';
export { MinimizedToolMessage } from './MinimizedToolMessage';

// Tool utilities - explicitly re-export to avoid conflicts
export {
  parseToolInput,
  getToolResultData,
  getProvider,
  isMinimizedTool,
  shouldHideToolResult,
  extractFilename,
} from './toolUtils';
