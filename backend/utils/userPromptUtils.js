/**
 * User Prompt Filter Utility
 *
 * Provides functionality to filter user prompt context from text,
 * preventing user prompt content from being displayed in the UI.
 */

// Markers used to identify and wrap user prompt context
const USER_PROMPT_START = '--- User Prompt Context ---';
const USER_PROMPT_END = '--- End User Prompt Context ---';

// Project prompt markers（与 user-prompt 对称，用于剥离注入的项目级提示词块）
const PROJECT_PROMPT_START = '--- Project Prompt ---';
const PROJECT_PROMPT_END = '--- End Project Prompt ---';

// 工具函数，供多个模块调用
/**
 * Remove user prompt context from text.
 * User prompt format: --- User Prompt Context ---\n...content...\n--- End User Prompt Context ---
 *
 * @param {string} text - Text that may contain user prompt context
 * @returns {string} Filtered text, or original text if no user prompt context found
 */
export function filterUserPromptContext(text) {
  if (typeof text !== 'string' || !text) {
    return text;
  }

  const userPromptStart = text.indexOf(USER_PROMPT_START);
  const userPromptEnd = text.indexOf(USER_PROMPT_END);

  if (userPromptStart !== -1 && userPromptEnd !== -1 && userPromptEnd > userPromptStart) {
    // Remove user prompt context, keep only user original input
    const filteredText =
      text.substring(0, userPromptStart).trim() +
      (text.substring(userPromptEnd + USER_PROMPT_END.length).trim() || '');

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
