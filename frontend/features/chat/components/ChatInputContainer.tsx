/**
 * ChatInputContainer Component
 *
 * Renders the main input container with textarea and action buttons.
 */

import { ChatInputActions } from './ChatInputActions';

interface ChatInputContainerProps {
  /** Dropzone root props */
  getRootProps: () => Record<string, unknown>;
  /** Dropzone input props */
  getInputProps: () => Record<string, unknown>;
  /** Is drag active */
  isDragActive: boolean;
  /** Is focused */
  isFocused: boolean;
  /** Textarea ref */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** Current value */
  value: string;
  /** On change handler */
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** On key down handler */
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** On focus handler */
  handleFocus: () => void;
  /** On blur handler */
  handleBlur: () => void;
  /** Placeholder */
  placeholder?: string;
  /** Disabled */
  disabled: boolean;
  /** Is loading */
  isLoading: boolean;
  /** Min rows */
  minRows: number;
  /** Can send */
  canSend: boolean;
  /** On send */
  onSend: () => void;
  /** Max file size */
  maxFileSize: number;
  /** On add file */
  onAddFile?: (file: import('../types').FileAttachment) => void;
  /** Handle file upload */
  handleFileUpload: (file: File, attachment: import('../types').FileAttachment) => Promise<void>;
}

export function ChatInputContainer({
  getRootProps,
  getInputProps,
  isDragActive,
  isFocused,
  textareaRef,
  value,
  handleInputChange,
  handleKeyDown,
  handleFocus,
  handleBlur,
  placeholder,
  disabled,
  isLoading,
  minRows,
  canSend,
  onSend,
  maxFileSize,
  onAddFile,
  handleFileUpload,
}: ChatInputContainerProps) {
  return (
    <div
      {...getRootProps()}
      className={`relative flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border-2 rounded-2xl transition-colors ${
        isDragActive
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : isFocused
          ? 'border-blue-500 dark:border-blue-400'
          : 'border-gray-300 dark:border-gray-600'
      }`}
    >
      <input {...getInputProps()} />

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        rows={minRows}
        className="flex-1 resize-none bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
        style={{ minHeight: `${minRows * 1.5}rem` }}
      />

      {/* Action buttons */}
      <ChatInputActions
        canSend={canSend}
        isLoading={isLoading}
        onSend={onSend}
        maxFileSize={maxFileSize}
        onAddFile={onAddFile}
        handleFileUpload={handleFileUpload}
      />
    </div>
  );
}
