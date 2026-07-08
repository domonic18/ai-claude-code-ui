/**
 * Memory Filter Utility
 *
 * Provides functionality to filter memory context from text,
 * preventing memory content from being displayed in the UI.
 */

// Memory markers used to identify and wrap memory context
const MEMORY_START = '--- Memory Context ---';
const MEMORY_END = '--- End Memory Context ---';

// Project prompt markers（与 memory 对称，用于剥离注入的项目级提示词块）
const PROJECT_PROMPT_START = '--- Project Prompt ---';
const PROJECT_PROMPT_END = '--- End Project Prompt ---';

// 工具函数，供多个模块调用
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

// 工具函数，供多个模块调用
/**
 * Remove project prompt context from text.
 * Project prompt format: --- Project Prompt ---\n...content...\n--- End Project Prompt ---
 *
 * @param {string} text - Text that may contain project prompt context
 * @returns {string} Filtered text, or original text if no project prompt found
 */
export function filterProjectPrompt(text) {
  if (typeof text !== 'string' || !text) {
    return text;
  }

  const promptStart = text.indexOf(PROJECT_PROMPT_START);
  const promptEnd = text.indexOf(PROJECT_PROMPT_END);

  if (promptStart !== -1 && promptEnd !== -1 && promptEnd > promptStart) {
    return text.substring(0, promptStart).trim() +
      (text.substring(promptEnd + PROJECT_PROMPT_END.length).trim() || '');
  }

  return text;
}

