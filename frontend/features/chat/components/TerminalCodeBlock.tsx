/**
 * TerminalCodeBlock Component
 *
 * Terminal-styled code block with copy button.
 * Renders code inside a terminal-like container with a header bar.
 */

import React from 'react';
import { CopyButton } from './CopyButton';

interface TerminalCodeBlockProps {
  content: string;
  className?: string;
  children?: React.ReactNode;
}

export function TerminalCodeBlock({ content, className, children }: TerminalCodeBlockProps) {
  return (
    <div className="relative group my-2">
      <div className="rounded-lg overflow-hidden border border-gray-700/50 bg-gray-950 shadow-xl">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-xs text-gray-400 font-medium">terminal</span>
        </div>

        <pre className="p-3 m-0 text-sm leading-relaxed overflow-x-auto">
          <code className={`text-gray-100 font-mono whitespace-pre-wrap break-words ${className || ''}`}>
            {children}
          </code>
        </pre>
      </div>

      <CopyButton
        text={content}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-gray-700/80 hover:bg-gray-700 text-white border border-gray-600 flex items-center gap-1"
        title="Copy output"
      />
    </div>
  );
}

interface TerminalOutputProps {
  content: string;
}

export function TerminalOutput({ content }: TerminalOutputProps) {
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-700/50 bg-gray-950 shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <span className="text-xs text-gray-400 font-medium">terminal</span>
      </div>

      <pre className="p-3 m-0 text-sm leading-relaxed overflow-x-auto">
        <code className="font-mono text-gray-100 whitespace-pre-wrap break-words">
          {content}
        </code>
      </pre>

      <div className="relative">
        <CopyButton
          text={content}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-gray-700/80 hover:bg-gray-700 text-white border border-gray-600 flex items-center gap-1"
          title="Copy output"
        />
      </div>
    </div>
  );
}
