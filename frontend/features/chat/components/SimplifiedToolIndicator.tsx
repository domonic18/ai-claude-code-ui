/**
 * SimplifiedToolIndicator Component
 *
 * Renders simplified indicators for frequently used tools (Read, TodoWrite).
 */

import React from 'react';
import { extractFilename } from './toolUtils';

export interface SimplifiedToolIndicatorProps {
  toolName: string;
  toolInput: string | null;
  onFileOpen?: (filePath: string) => void;
}

/**
 * SimplifiedToolIndicator Component
 *
 * Displays compact indicators for tools that don't need full rendering.
 */
export function SimplifiedToolIndicator({ toolName, toolInput, onFileOpen }: SimplifiedToolIndicatorProps) {
  switch (toolName) {
    case 'Read':
      return <ReadIndicator toolInput={toolInput} onFileOpen={onFileOpen} />;
    case 'TodoWrite':
      return <TodoWriteIndicator toolInput={toolInput} />;
    default:
      return null;
  }
}

/**
 * Render simplified Read tool indicator
 */
function ReadIndicator({ toolInput, onFileOpen }: { toolInput: string | null; onFileOpen?: (filePath: string) => void }) {
  if (!toolInput) return null;

  let input;
  try {
    input = JSON.parse(toolInput);
  } catch {
    return null;
  }

  if (!input?.file_path) return null;

  const filename = extractFilename(input.file_path);

  return (
    <div className="bg-gray-50/50 dark:bg-gray-800/30 border-l-2 border-gray-400 dark:border-gray-500 pl-3 py-2 my-2">
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="font-medium">Read</span>
        <button
          onClick={() => onFileOpen?.(input.file_path)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-mono transition-colors"
        >
          {filename}
        </button>
      </div>
    </div>
  );
}

/**
 * Render simplified TodoWrite indicator
 */
function TodoWriteIndicator({ toolInput }: { toolInput: string | null }) {
  if (!toolInput) return null;

  let input;
  try {
    input = JSON.parse(toolInput);
  } catch {
    return null;
  }

  if (!input?.todos || !Array.isArray(input.todos)) {
    return null;
  }

  return (
    <div className="bg-gray-50/50 dark:bg-gray-800/30 border-l-2 border-gray-400 dark:border-gray-500 pl-3 py-2 my-2">
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
        <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span className="font-medium">Update todo list</span>
      </div>
      <TodoList todos={input.todos} />
    </div>
  );
}

/**
 * Simple TodoList component
 */
interface Todo {
  id: string;
  content: string;
  status: 'pending' | 'completed';
}

interface TodoListProps {
  todos: Todo[];
}

function TodoList({ todos }: TodoListProps) {
  return (
    <ul className="space-y-1 text-xs">
      {todos.map((todo) => (
        <li key={todo.id} className="flex items-start gap-2">
          <span className={`mt-0.5 w-3 h-3 rounded border flex-shrink-0 ${
            todo.status === 'completed'
              ? 'bg-green-500 border-green-500'
              : 'border-gray-400 dark:border-gray-500'
          }`}>
            {todo.status === 'completed' && (
              <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className={todo.status === 'completed' ? 'line-through text-gray-500' : ''}>
            {todo.content}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default SimplifiedToolIndicator;
