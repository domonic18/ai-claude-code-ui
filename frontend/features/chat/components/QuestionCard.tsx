/**
 * QuestionCard 组件
 *
 * 渲染 Agent 的 AskUserQuestion 结构化提问（对齐 Claude Code CLI 原生交互）：
 * - 每个问题块：header 标签 + 问题文本 + 选项列表（单选 radio / multiSelect checkbox）
 * - 自由文本输入框（可选填，作为回答补充）
 * - 提交按钮（Enter 触发）+ 跳过按钮（CLI 语义：任务继续，模型自行决策）
 *
 * 状态机：pending（可交互）→ answered（显示所选摘要，只读）
 *                      → skipped（显示"已跳过"）
 *                      → invalid（会话结束/中断，灰化不可交互）
 *
 * 回答协议（与后端 canUseToolTemplate.js 对齐）：
 * - 有选项选中 → mode:'options', answers: { [问题文本]: label（多选逗号join） }
 * - 只填文本 → mode:'text', response: 文本
 * - 跳过 → mode:'skip'
 */

import { useState, useMemo } from 'react';
import type { ChatMessage } from '../types';
import { dispatchQuestionAnswer } from '../services/questionEvents';

/** QuestionCard 组件属性 */
export interface QuestionCardProps {
  /** agent-question 结构化消息 */
  message: ChatMessage;
  /** 所属会话 ID（回答按会话路由） */
  sessionId: string;
}

/** 选项按钮样式（选中/未选中） */
function optionClasses(selected: boolean): string {
  return `w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-start gap-2.5 ${selected
    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`;
}

/**
 * QuestionCard：结构化提问卡片
 */
export function QuestionCard({ message, sessionId }: QuestionCardProps) {
  const { toolUseID, questions, prompt, status } = message.interactiveQuestion!;
  const isPending = (status || 'pending') === 'pending' && !message.isAnswered;

  // 每个问题的选中项：question 文本 → label 数组（multiSelect 可多项）
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  // 自由文本输入
  const [text, setText] = useState('');

  /** 切换选项选中态（multiSelect 互斥/叠加） */
  const toggleOption = (question: string, label: string, multiSelect: boolean) => {
    setSelected(prev => {
      const cur = prev[question] || [];
      if (multiSelect) {
        return { ...prev, [question]: cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label] };
      }
      return { ...prev, [question]: cur.includes(label) ? [] : [label] };
    });
  };

  const hasSelection = useMemo(
    () => Object.values(selected).some(labels => labels.length > 0),
    [selected]
  );

  /** 提交：有选项选中走 options 模式，否则文本走 text 模式；都空则不响应 */
  const handleSubmit = () => {
    if (!isPending) return;
    if (hasSelection) {
      // 按问题文本构造映射（多选逗号 join，与 CLI 协议一致）
      const answers: Record<string, string> = {};
      const summaryParts: string[] = [];
      for (const [q, labels] of Object.entries(selected)) {
        if (labels.length > 0) {
          answers[q] = labels.join(', ');
          summaryParts.push(labels.join(', '));
        }
      }
      dispatchQuestionAnswer(toolUseID, sessionId, {
        mode: 'options', answers, ...(text.trim() && { response: text.trim() })
      }, summaryParts.join('；'));
    } else if (text.trim()) {
      dispatchQuestionAnswer(toolUseID, sessionId, { mode: 'text', response: text.trim() }, text.trim());
    }
  };

  /** 跳过：CLI 语义，deny 后任务继续，模型自行决策 */
  const handleSkip = () => {
    if (!isPending) return;
    dispatchQuestionAnswer(toolUseID, sessionId, { mode: 'skip' }, '已跳过');
  };

  /** 键盘：Enter 直接提交（输入框内） */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 终态：回答后展示所选摘要
  const answeredSummary = (status === 'answered' || message.isAnswered) && message.interactiveQuestion!.answerSummary;

  return (
    <div className={`w-full rounded-xl border p-4 space-y-4 ${status === 'invalid'
      ? 'border-gray-200 dark:border-gray-700 opacity-60'
      : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20'}`}>
      {/* 提问引导语 */}
      {prompt && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{prompt}</p>
      )}

      {/* 逐题渲染 */}
      {questions.map((q, qi) => (
        <div key={q.question} className="space-y-2" data-testid={`question-block-${qi}`}>
          <div className="flex items-center gap-2">
            {q.header && (
              <span className="px-2 py-0.5 text-xs font-semibold uppercase rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {q.header}
              </span>
            )}
            <span className="text-sm text-gray-800 dark:text-gray-100">{q.question}</span>
            {q.multiSelect && (
              <span className="text-xs text-gray-400">（可多选）</span>
            )}
          </div>

          <div className="space-y-1.5">
            {(q.options || []).map(opt => {
              const labels = selected[q.question] || [];
              const isSelected = labels.includes(opt.label);
              return (
                <button
                  key={opt.label}
                  type="button"
                  disabled={!isPending}
                  onClick={() => toggleOption(q.question, opt.label, !!q.multiSelect)}
                  className={optionClasses(isSelected)}
                >
                  <span className={`mt-0.5 flex-shrink-0 w-4 h-4 border rounded-${q.multiSelect ? 'sm' : 'full'} flex items-center justify-center text-[10px] ${isSelected
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-300 dark:border-gray-600'}`}>
                    {isSelected && '✓'}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">{opt.label}</span>
                    {opt.description && (
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 终态摘要 / 交互区 */}
      {status === 'answered' && answeredSummary && (
        <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
          已回答：{answeredSummary}
        </div>
      )}
      {status === 'skipped' && (
        <div className="text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">已跳过</div>
      )}
      {status === 'invalid' && (
        <div className="text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">该提问已失效（会话已结束或中断）</div>
      )}

      {isPending && (
        <div className="space-y-2 border-t border-blue-200 dark:border-blue-800 pt-3">
          {/* 自由文本输入（可选） */}
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="或输入自定义回答（可选）"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid="question-free-text"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasSelection && !text.trim()}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="question-submit"
            >
              提交
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              data-testid="question-skip"
            >
              跳过
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuestionCard;
