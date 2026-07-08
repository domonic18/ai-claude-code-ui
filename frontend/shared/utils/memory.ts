/**
 * Memory Utils
 *
 * Utility functions for filtering memory context from text.
 * This prevents memory content from being displayed in the UI chat.
 */

// Memory markers used to identify and wrap memory context
const MEMORY_START = '--- Memory Context ---';
const MEMORY_END = '--- End Memory Context ---';

// Project prompt markers（与 memory 对称）
const PROJECT_PROMPT_START = '--- Project Prompt ---';
const PROJECT_PROMPT_END = '--- End Project Prompt ---';

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

/**
 * Remove project prompt context from text.
 * Project prompt format: --- Project Prompt ---\n...content...\n--- End Project Prompt ---
 *
 * 注：前端实时消息显示的是用户原始输入（不含注入块），通常无需调用；
 * 历史消息的剥离由后端 filterProjectPromptFromEntry 完成。本函数保留与
 * filterMemoryContext 对称，供未来前端直显后端拼接内容时使用。
 *
 * @param text - Text that may contain project prompt context
 * @returns Filtered text, or original text if no project prompt found
 */
export function filterProjectPrompt(text: string | undefined | null): string | undefined | null {
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
