/**
 * Message Filter Configuration
 *
 * Defines filter patterns for detecting and filtering
 * system messages, skill prompts, and internal commands.
 */

/**
 * Skill system prompt detection indicators
 * At least 2 matches required for positive identification
 */
export const SKILL_INDICATORS = [
  '## 角色设定',
  '## 任务目标',
  '## 工作流程',
  '## 何时使用此工作流',
  '## 标准评估报告模板',
  'Base directory for this skill'
] as const;

/**
 * Message prefixes that should be filtered out
 */
export const SKIP_PREFIXES = [
  '<command-name>',
  '<command-message>',
  '<command-args>',
  '<local-command-stdout>',
  '<system-reminder>',
  'Caveat:',
  'This session is being continued from a previous',
  '[Request interrupted'
] as const;

/**
 * Check if content is a skill system prompt
 * @param content - Message content to check
 * @returns true if content appears to be a skill system prompt
 */
export function isSkillSystemPrompt(content: string): boolean {
  // Direct patterns
  if (content.includes('Base directory for this skill:') ||
    (content.includes('/.claude/skills/') && content.includes('# '))) {
    return true;
  }

  // YAML-like skill definition pattern
  if (content.startsWith('---') &&
    content.includes('name:') &&
    content.includes('description:') &&
    content.includes('tools:')) {
    return true;
  }

  // Multi-indicator pattern (at least 2 matches)
  const indicatorCount = SKILL_INDICATORS.filter(
    indicator => content.includes(indicator)
  ).length;

  return indicatorCount >= 2 && content.length > 1000;
}

/**
 * Check if user message should be skipped
 * @param content - Message content to check
 * @returns true if message should be filtered out
 */
export function shouldSkipUserMessage(content: string): boolean {
  if (!content) return true;
  if (SKIP_PREFIXES.some(prefix => content.startsWith(prefix))) return true;
  if (isSkillSystemPrompt(content)) return true;
  return false;
}
