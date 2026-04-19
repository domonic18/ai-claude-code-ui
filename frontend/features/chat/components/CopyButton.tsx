/**
 * CopyButton Component
 *
 * Reusable copy-to-clipboard button with visual feedback.
 * Uses Clipboard API with fallback to execCommand.
 */

import React, { useState } from 'react';

function fallbackCopy(text: string, callback: () => void) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
  } catch {
    // Ignore errors
  }

  document.body.removeChild(textarea);
  callback();
}

function copyToClipboard(text: string, onSuccess: () => void) {
  try {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        fallbackCopy(text, onSuccess);
      });
    } else {
      fallbackCopy(text, onSuccess);
    }
  } catch {
    fallbackCopy(text, onSuccess);
  }
}

interface CopyButtonProps {
  text: string;
  title?: string;
  className?: string;
  feedbackDuration?: number;
}

export function CopyButton({ text, title, className, feedbackDuration = 1500 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(text, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), feedbackDuration);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className}
      title={copied ? 'Copied' : (title || 'Copy')}
      aria-label={copied ? 'Copied' : (title || 'Copy')}
    >
      {copied ? (
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Copied
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
          </svg>
          Copy
        </span>
      )}
    </button>
  );
}

export { fallbackCopy };
export default CopyButton;
