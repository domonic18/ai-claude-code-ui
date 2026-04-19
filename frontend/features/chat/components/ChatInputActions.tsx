/**
 * ChatInputActions Component
 *
 * Displays the send button and file upload button.
 */

import type { FileAttachment } from '../types';

interface ChatInputActionsProps {
  /** Can send message */
  canSend: boolean;
  /** Is loading */
  isLoading?: boolean;
  /** Send callback */
  onSend: () => void;
  /** Maximum file size */
  maxFileSize: number;
  /** Add file callback */
  onAddFile?: (file: FileAttachment) => void;
  /** File upload handler */
  handleFileUpload: (file: File, attachment: FileAttachment) => Promise<void>;
}

export function ChatInputActions({
  canSend,
  isLoading = false,
  onSend,
  maxFileSize,
  onAddFile,
  handleFileUpload,
}: ChatInputActionsProps) {
  return (
    <>
      {/* Send button */}
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className="flex-shrink-0 p-2 rounded-full transition-colors"
      >
        {isLoading ? (
          <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : canSend ? (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
      </button>

      {/* File upload button */}
      <label className="flex-shrink-0 p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer">
        <input
          type="file"
          accept=".docx,.pdf,.md,.txt,.js,.ts,.jsx,.tsx,.json,.csv,image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(file => {
              if (file.size <= maxFileSize) {
                const attachment: FileAttachment = {
                  id: `${file.name}-${Date.now()}`, // Generate unique ID
                  name: file.name,
                  size: file.size,
                  type: file.type,
                };

                if (file.type.startsWith('image/')) {
                  // For images, store as base64
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    attachment.data = ev.target?.result as string;
                    onAddFile?.(attachment);
                  };
                  reader.readAsDataURL(file);
                } else {
                  // For documents, upload to server
                  handleFileUpload(file, attachment);
                }
              }
            });
            // Reset input so same file can be selected again
            e.target.value = '';
          }}
          className="hidden"
        />
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </label>
    </>
  );
}
