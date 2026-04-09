/**
 * Memory Filter Utility
 *
 * Provides functionality to filter memory context from text,
 * preventing memory content from being displayed in the UI.
 */

// Memory markers used to identify and wrap memory context
const MEMORY_START = '--- Memory Context ---';
const MEMORY_END = '--- End Memory Context ---';

/**
 * Remove memory context from text.
 * Memory context format: --- Memory Context ---\n...content...\n--- End Memory Context ---
 *
 * @param {string} text - Text that may contain memory context
 * @returns {string} Filtered text, or original text if no memory context found
 */
export function filterMemoryContext(text) {
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
