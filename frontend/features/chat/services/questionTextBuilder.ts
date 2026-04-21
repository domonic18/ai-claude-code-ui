/**
 * Agent 提问文本构建器
 *
 * 将 AskUserQuestion 工具的提问数据格式化为纯文本内容，
 * 供前端以普通 assistant 消息形式展示。
 *
 * @module chat/services/questionTextBuilder
 */

/** 默认占位文本 */
const FALLBACK_TEXT = 'Agent is asking a question...';

/** 选项的类型定义 */
type QuestionOption = { label: string; description?: string };

/**
 * 将单个选项格式化为 "- label: description" 或 "- label"
 */
function formatOption(o: QuestionOption): string {
  return o.description ? `- ${o.label}: ${o.description}` : `- ${o.label}`;
}

/**
 * 将单个问题及其选项格式化为文本
 */
function formatQuestion(q: { question?: string; options?: QuestionOption[] }): string {
  const text = q.question || '';
  const optionsText = q.options?.length ? '\n' + q.options.map(formatOption).join('\n') : '';
  return text + optionsText;
}

/**
 * 将 Agent 提问数据构建为纯文本内容
 *
 * @param prompt - 提示文本
 * @param questions - 问题列表
 * @returns 格式化后的文本内容
 */
export function buildQuestionText(prompt?: string, questions?: Array<{ question?: string; options?: QuestionOption[] }>): string {
  const parts: string[] = [];
  if (prompt) parts.push(prompt);
  if (questions?.length) {
    for (const q of questions) {
      const text = formatQuestion(q);
      if (text) parts.push(text);
    }
  }
  return parts.join('\n\n') || FALLBACK_TEXT;
}
