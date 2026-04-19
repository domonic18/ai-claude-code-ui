/**
 * ChatInputWrapper Component
 *
 * Wrapper component that bundles the main ChatInput structure.
 */

import { FileAttachmentsPreview } from './FileAttachmentsPreview';
import { ChatInputContainer } from './ChatInputContainer';
import { ChatInputHint } from './ChatInputHint';
import { ChatInputMenus } from './ChatInputMenus';
import type { FileAttachment } from '../types';

interface ChatInputWrapperProps {
  /** Files */
  files: FileAttachment[];
  /** Handle remove file */
  handleRemoveFile: (fileId: string) => void;
  /** Get root props */
  getRootProps: () => Record<string, unknown>;
  /** Get input props */
  getInputProps: () => Record<string, unknown>;
  /** Is drag active */
  isDragActive: boolean;
  /** Is focused */
  isFocused: boolean;
  /** Textarea ref */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** Value */
  value: string;
  /** Handle input change */
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Handle key down */
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Handle focus */
  handleFocus: () => void;
  /** Handle blur */
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
  onAddFile?: (file: FileAttachment) => void;
  /** Handle file upload */
  handleFileUpload: (file: File, attachment: FileAttachment) => Promise<void>;
  /** Send by Ctrl+Enter */
  sendByCtrlEnter: boolean;
  /** Has selected project */
  hasProject: boolean;
  /** Menu props */
  menuProps: Record<string, unknown>;
}

export function ChatInputWrapper({
  files,
  handleRemoveFile,
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
  sendByCtrlEnter,
  hasProject,
  menuProps,
}: ChatInputWrapperProps) {
  return (
    <div className="relative" data-tour="chat-input">
      {/* File attachments preview */}
      {files.length > 0 && (
        <FileAttachmentsPreview
          files={files}
          onRemoveFile={handleRemoveFile}
        />
      )}

      {/* Input container */}
      <ChatInputContainer
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        isFocused={isFocused}
        textareaRef={textareaRef}
        value={value}
        handleInputChange={handleInputChange}
        handleKeyDown={handleKeyDown}
        handleFocus={handleFocus}
        handleBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        isLoading={isLoading}
        minRows={minRows}
        canSend={canSend}
        onSend={onSend}
        maxFileSize={maxFileSize}
        onAddFile={onAddFile}
        handleFileUpload={handleFileUpload}
      />

      {/* Hint text */}
      <ChatInputHint
        sendByCtrlEnter={sendByCtrlEnter}
        hasProject={hasProject}
      />

      {/* Menus */}
      <ChatInputMenus {...menuProps} />
    </div>
  );
}
