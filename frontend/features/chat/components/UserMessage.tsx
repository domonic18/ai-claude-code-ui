/**
 * UserMessage Component
 *
 * Renders a user message with optional image attachments.
 */

import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';

export interface UserMessageProps {
  message: ChatMessageType;
  isGrouped: boolean;
}

/**
 * UserMessage Component
 *
 * Displays user messages with right-aligned layout and optional image attachments.
 */
export function UserMessage({ message, isGrouped }: UserMessageProps) {
  return (
    <div
      className={`chat-message user ${isGrouped ? 'grouped' : ''} flex justify-end px-3 sm:px-0`}
    >
      <div className="flex items-end space-x-0 sm:space-x-3 w-full sm:w-auto sm:max-w-[85%] md:max-w-md lg:max-w-xl">
        <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-3 sm:px-4 py-2 shadow-sm flex-1 sm:flex-initial">
          {/* Message content */}
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>

          {/* Image attachments */}
          {message.images && message.images.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {message.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img.data}
                  alt={img.name}
                  className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(img.data, '_blank')}
                />
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-blue-100 mt-1 text-right">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* User avatar (only show if not grouped) */}
        {!isGrouped && (
          <div className="hidden sm:flex w-8 h-8 bg-blue-600 rounded-full items-center justify-center text-white text-sm flex-shrink-0">
            U
          </div>
        )}
      </div>
    </div>
  );
}

export default UserMessage;
