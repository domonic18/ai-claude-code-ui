/**
 * QuestionCard 组件测试
 *
 * 覆盖 AskUserQuestion 结构化卡片的核心交互与协议载荷构造：
 * - 单选/多选切换与提交载荷（answers 按问题文本映射、多选逗号join）
 * - 纯文本回答载荷（mode:'text' + response）
 * - 跳过载荷（mode:'skip'）
 * - 终态（answered/skipped/invalid）只读不可交互
 *
 * 提交动作经 questionEvents 桥接派发（mock 之）。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';

// Mock 桥接模块：捕获派发载荷。
// 注意：vi.mock 工厂被 hoist，不能引用外部变量——用 vi.hoisted 声明 spy；
// 路径必须与 QuestionCard.tsx 内的解析目标一致（components/../services → chat/services）
const { dispatchMock } = vi.hoisted(() => ({ dispatchMock: vi.fn() }));
vi.mock('../../services/questionEvents', () => ({
  dispatchQuestionAnswer: (...args: unknown[]) => dispatchMock(...args),
}));

import { QuestionCard } from '../QuestionCard';
import type { ChatMessage } from '../types';

/** 构造一条 agent-question 消息 */
function makeQuestionMessage(overrides: Partial<NonNullable<ChatMessage['interactiveQuestion']>> = {}): ChatMessage {
  return {
    id: 'msg-1',
    type: 'assistant',
    content: '',
    timestamp: Date.now(),
    toolCallId: 'session-A',
    interactiveQuestion: {
      toolUseID: 'tu_1',
      questions: [
        {
          question: '整体策略?',
          header: '策略',
          multiSelect: false,
          options: [
            { label: '授权优先版（推荐）', description: '删权8/9/10' },
            { label: '保守版', description: '仅修清楚性问题' },
          ],
        },
        {
          question: '启用哪些功能?',
          multiSelect: true,
          options: [
            { label: '功能A', description: '' },
            { label: '功能B', description: '' },
          ],
        },
      ],
      prompt: '请确认两个决策',
      status: 'pending',
      ...overrides,
    },
  };
}

describe('QuestionCard - pending 交互', () => {
  beforeEach(() => {
    dispatchMock.mockClear();
  });

  afterEach(cleanup);

  it('渲染 prompt、问题与选项', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    expect(screen.getByText('请确认两个决策')).toBeTruthy();
    expect(screen.getByText('整体策略?')).toBeTruthy();
    expect(screen.getByText('授权优先版（推荐）')).toBeTruthy();
    expect(screen.getByText('（可多选）')).toBeTruthy(); // multiSelect 标识
  });

  it('单选：点击选项后提交，载荷为 answers 映射（问题文本→label）', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    fireEvent.click(screen.getByText('授权优先版（推荐）'));
    fireEvent.click(screen.getByTestId('question-submit'));

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const [toolUseID, sessionId, payload, summary] = dispatchMock.mock.calls[0];
    expect(toolUseID).toBe('tu_1');
    expect(sessionId).toBe('session-A');
    expect(payload.mode).toBe('options');
    expect(payload.answers).toEqual({ '整体策略?': '授权优先版（推荐）' });
    expect(summary).toContain('授权优先版（推荐）');
  });

  it('多选：两项选中时 answers 值为逗号 join', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    fireEvent.click(screen.getByText('功能A'));
    fireEvent.click(screen.getByText('功能B'));
    fireEvent.click(screen.getByTestId('question-submit'));

    const [, , payload] = dispatchMock.mock.calls[0];
    expect(payload.answers['启用哪些功能?']).toBe('功能A, 功能B');
  });

  it('单选二次点击取消选中（toggle）', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    const opt = screen.getByText('授权优先版（推荐）');
    fireEvent.click(opt);
    fireEvent.click(opt); // 再点取消

    // 无选项无文本：提交按钮 disabled
    expect((screen.getByTestId('question-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('纯文本：输入后提交，载荷为 mode:text + response', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    fireEvent.change(screen.getByTestId('question-free-text'), { target: { value: '我要自定义方案' } });
    fireEvent.click(screen.getByTestId('question-submit'));

    const [, , payload] = dispatchMock.mock.calls[0];
    expect(payload.mode).toBe('text');
    expect(payload.response).toBe('我要自定义方案');
  });

  it('文本框 Enter 触发提交', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    const input = screen.getByTestId('question-free-text');
    fireEvent.change(input, { target: { value: '回车提交' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock.mock.calls[0][2].response).toBe('回车提交');
  });

  it('选项+文本同时存在：options 模式并附带 response', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    fireEvent.click(screen.getByText('保守版'));
    fireEvent.change(screen.getByTestId('question-free-text'), { target: { value: '补充说明' } });
    fireEvent.click(screen.getByTestId('question-submit'));

    const [, , payload] = dispatchMock.mock.calls[0];
    expect(payload.mode).toBe('options');
    expect(payload.answers['整体策略?']).toBe('保守版');
    expect(payload.response).toBe('补充说明');
  });

  it('跳过：载荷为 mode:skip', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    fireEvent.click(screen.getByTestId('question-skip'));

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const [, , payload] = dispatchMock.mock.calls[0];
    expect(payload.mode).toBe('skip');
  });

  it('无选项无文本时提交按钮禁用', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    expect((screen.getByTestId('question-submit') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('QuestionCard - 终态只读', () => {
  beforeEach(() => dispatchMock.mockClear());
  afterEach(cleanup);

  it('answered 态：显示摘要，不渲染交互控件', () => {
    render(<QuestionCard message={makeQuestionMessage({ status: 'answered', answerSummary: '授权优先版（推荐）' })} sessionId="session-A" />);

    expect(screen.getByText(/已回答：授权优先版（推荐）/)).toBeTruthy();
    expect(screen.queryByTestId('question-submit')).toBeNull();
    expect(screen.queryByTestId('question-skip')).toBeNull();
  });

  it('skipped 态：显示已跳过，不渲染交互控件', () => {
    render(<QuestionCard message={makeQuestionMessage({ status: 'skipped' })} sessionId="session-A" />);

    expect(screen.getByText('已跳过')).toBeTruthy();
    expect(screen.queryByTestId('question-submit')).toBeNull();
  });

  it('invalid 态（会话结束）：显示失效提示，选项不可点击', () => {
    render(<QuestionCard message={makeQuestionMessage({ status: 'invalid' })} sessionId="session-A" />);

    expect(screen.getByText(/该提问已失效/)).toBeTruthy();
    // 选项按钮 disabled
    const optButton = screen.getByText('授权优先版（推荐）').closest('button') as HTMLButtonElement;
    expect(optButton.disabled).toBe(true);
  });

  it('auto-answered 态（AFK 超时自动采用）：显示自动采用的选项，不渲染交互控件', () => {
    render(<QuestionCard message={makeQuestionMessage({ status: 'auto-answered', answerSummary: '授权优先版（推荐）' })} sessionId="session-A" />);

    expect(screen.getByTestId('question-auto-answered')).toBeTruthy();
    expect(screen.getByText(/已超时，自动采用：授权优先版（推荐）/)).toBeTruthy();
    expect(screen.queryByTestId('question-submit')).toBeNull();
    expect(screen.queryByTestId('question-skip')).toBeNull();
    // 终态下不再渲染倒计时
    expect(screen.queryByTestId('question-countdown')).toBeNull();
  });

  it('isAnswered 旧标记同样进入只读态（兼容历史消息）', () => {
    const msg = { ...makeQuestionMessage(), isAnswered: true };
    render(<QuestionCard message={msg} sessionId="session-A" />);

    expect(screen.queryByTestId('question-submit')).toBeNull();
  });
});

describe('QuestionCard - AFK 倒计时', () => {
  beforeEach(() => {
    dispatchMock.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  /** 构造带 timeoutMs 的消息（timestamp 用假时钟当前时刻，避免真实漂移） */
  const makeTimedMessage = (timeoutMs: number, startedAt = Date.now()): ChatMessage =>
    ({ ...makeQuestionMessage({ timeoutMs }), timestamp: startedAt });

  it('下发 timeoutMs 时渲染倒计时线（满格起步）', () => {
    render(<QuestionCard message={makeTimedMessage(300000)} sessionId="session-A" />);

    expect(screen.getByTestId('question-countdown')).toBeTruthy();
    expect(screen.getByTestId('question-countdown-remaining').textContent).toBe('5:00');
    const bar = screen.getByTestId('question-countdown-bar') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('未下发 timeoutMs（旧后端兼容）：不渲染倒计时，卡片正常可交互', () => {
    render(<QuestionCard message={makeQuestionMessage()} sessionId="session-A" />);

    expect(screen.queryByTestId('question-countdown')).toBeNull();
    expect(screen.getByTestId('question-submit')).toBeTruthy();
  });

  it('剩余时间随 tick 递减，进度条宽度线性下降', () => {
    render(<QuestionCard message={makeTimedMessage(300000)} sessionId="session-A" />);

    act(() => { vi.advanceTimersByTime(150000); });
    expect(screen.getByTestId('question-countdown-remaining').textContent).toBe('2:30');
    const bar = screen.getByTestId('question-countdown-bar') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('归零后：卡片禁用并提示已超时，点击选项不再派发', () => {
    render(<QuestionCard message={makeTimedMessage(1000)} sessionId="session-A" />);

    act(() => { vi.advanceTimersByTime(1100); });

    expect(screen.getByTestId('question-expired')).toBeTruthy();
    // 交互控件整体隐藏（pending 区让位于超时提示）
    expect(screen.queryByTestId('question-submit')).toBeNull();
    expect(screen.queryByTestId('question-skip')).toBeNull();
    // 选项按钮 disabled：超时后回答不被采纳，不允许再选
    const optButton = screen.getByText('授权优先版（推荐）').closest('button') as HTMLButtonElement;
    expect(optButton.disabled).toBe(true);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('终态（answered）：不渲染倒计时', () => {
    const msg = makeTimedMessage(300000);
    render(<QuestionCard message={makeQuestionMessage({ timeoutMs: 300000, status: 'answered', answerSummary: 'x' })} sessionId="session-A" />);

    expect(screen.queryByTestId('question-countdown')).toBeNull();
    expect(msg.interactiveQuestion!.timeoutMs).toBe(300000);
  });
});
