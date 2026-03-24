/**
 * Memory Utils
 *
 * Utility functions for filtering memory context from text.
 * This prevents memory content from being displayed in the UI chat.
 */

// Memory markers used to identify and wrap memory context
const MEMORY_START = '--- Memory Context ---';
const MEMORY_END = '--- End Memory Context ---';

/**
 * Remove memory context from text.
 * Memory context format: --- Memory Context ---\n...content...\n--- End Memory Context ---
 *
 * @param text - Text that may contain memory context
 * @returns Filtered text, or original text if no memory context found
 */
export function filterMemoryContext(text: string | undefined | null): string | undefined | null {
  if (typeof text !== 'string' || !text) {
    return text;
  }

  const memoryContextStart = text.indexOf(MEMORY_START);
  const memoryContextEnd = text.indexOf(MEMORY_END);

  if (memoryContextStart !== -1 && memoryContextEnd !== -1 && memoryContextEnd > memoryContextStart) {
    // Remove memory context, keep only user original input
    const filteredText =
      text.substring(0, memoryContextStart).trim() +
      (text.substring(memoryContextEnd + MEMORY_END.length).trim() || '');

    return filteredText;
  }

  return text;
}
