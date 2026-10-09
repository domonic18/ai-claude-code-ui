/**
 * replyProcessAggregator 单测
 *
 * 覆盖：回复边界分组、思考/工具/过渡句吸收、交互卡与错误不吸收、
 * 活跃段 live 标记、失败态与自愈、总耗时透传、输入不可变（防突变
 * 回归——旧 displayOptimizer 曾因此成倍复制过渡句）、重复执行幂等、
 * 任务工具跳过、正文透传。
 */
import { describe, it, expect } from 'vitest';
import { withReplyProcess, isNarration } from '../replyProcessAggregator';
import type { ChatMessage } from '../../types';

function userMsg(id: string): ChatMessage {
  return { id, type: 'user', content: 'q', timestamp: 1 };
}
function textMsg(id: string, content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id, type: 'assistant', content, timestamp: 1, ...extra };
}
function toolMsg(id: string, toolName: string, input: any = {}, toolResult?: any): ChatMessage {
  return {
    id, type: 'assistant', content: '', timestamp: 1,
    isToolUse: true, toolName, toolInput: JSON.stringify(input),
    ...(toolResult !== undefined ? { toolResult } : {}),
  };
}
function thinkingMsg(id: string, opts: { inProgress?: boolean; durationMs?: number } = {}): ChatMessage {
  return {
    id, type: 'assistant', content: '', timestamp: 1,
    isThinking: true, thinking: `think-${id}`,
    ...(opts.inProgress ? { thinkingInProgress: true } : {}),
    ...(opts.durationMs != null ? { thinkingDurationMs: opts.durationMs } : {}),
  };
}

describe('isNarration', () => {
  it('短无结构非流式文本是旁白', () => {
    expect(isNarration(textMsg('1', '让我检查一下源文件：'))).toBe(true);
  });
  it('超长/markdown/流式中都不是', () => {
    expect(isNarration(textMsg('2', '一'.repeat(301)))).toBe(false);
    expect(isNarration(textMsg('3', '## 标题'))).toBe(false);
    expect(isNarration(textMsg('4', '正在流出', { isStreaming: true }))).toBe(false);
  });
});

describe('withReplyProcess', () => {
  it('正文封箱：真正的正文（长回答/markdown）出现即旧组收口，后续过程开新组排在正文下方', () => {
    // 回归：曾出现"正文已输出，后续深度思考仍塞进上方旧组"的心智错乱
    const longAnswer = '## 验证结论\n\n经全面核验，PCT-0026pct-完整版.docx 的 claim_count 为 10 项，不符合 software-20 模式要求的 20 项权利要求结构。建议重新生成前先确认源文件的权利要求拆分。';
    const input = [
      userMsg('u1'),
      thinkingMsg('t1', { durationMs: 500 }),
      toolMsg('b1', 'Bash', { command: 'pct_selftest.py' }, { content: 'PASS' }),
      textMsg('a1', longAnswer), // markdown 结构 = 正文，触发封箱
      thinkingMsg('t2', { inProgress: true }), // 正文后的新过程
    ];
    const out = withReplyProcess(input);
    const groups = out.filter(m => m.replyProcess);
    expect(groups).toHaveLength(2); // 正文前后各一组
    const idx = {
      g1: out.findIndex(m => m.replyProcess),
      a: out.findIndex(m => m.id === 'a1'),
      g2: out.findIndex(m => m.replyProcess && m.replyProcess.status === 'active'),
    };
    expect(idx.g1).toBeGreaterThan(-1);
    expect(idx.a).toBeGreaterThan(idx.g1);   // 正文在旧组之后
    expect(idx.g2).toBeGreaterThan(idx.a);   // 新组在正文之后
    expect(groups[0].replyProcess!.status).toBe('done'); // 旧组封箱
    expect(groups[0].replyProcess!.liveThinking).toBe(''); // live 清空
    expect(groups[1].replyProcess!.liveThinking).toBe('think-t2'); // 新组承载后续思考
  });

  it('组吸收思考与工具，主视图只剩组头与正文', () => {
    const input = [
      userMsg('u1'),
      thinkingMsg('t1', { durationMs: 800 }),
      toolMsg('b1', 'Bash', { command: 'officecli --version' }, { content: '1.0.132' }),
      textMsg('a1', '## 权利要求转换报告\n转换已全部完成，详情如下。'),
    ];
    const out = withReplyProcess(input);
    // 组头 + 正文 + 用户消息 = 3 条；思考/工具被吸收
    expect(out.map(m => m.id)).toEqual(['u1', expect.stringMatching(/^reply-process-/), 'a1']);
    const header = out.find(m => m.replyProcess)!;
    expect(header.replyProcess!.thinkingCount).toBe(1);
    expect(header.replyProcess!.toolCount).toBe(1);
    expect(header.replyProcess!.entries).toHaveLength(2); // 思考 + 工具均已完成，入抽屉
    expect(header.replyProcess!.status).toBe('done'); // 正文出现即封箱（尾组也无续过程）
    // 工具条目语义化
    const toolEntry = header.replyProcess!.entries.find(e => e.kind === 'tool')!;
    expect(toolEntry.actionLabel).toBe('运行命令');
    expect(toolEntry.summary).toBe('officecli --version');
  });

  it('用户消息收口前一组：done + 总耗时透传', () => {
    const input = [
      userMsg('u1'),
      thinkingMsg('t1', { durationMs: 500 }),
      textMsg('a1', '正文', { durationMs: 66000 }),
      userMsg('u2'),
    ];
    const out = withReplyProcess(input);
    const header = out.find(m => m.replyProcess)!;
    expect(header.replyProcess!.status).toBe('done');
    expect(header.replyProcess!.totalDurationMs).toBe(66000);
  });

  it('活跃思考段进 live 区不入抽屉', () => {
    const input = [
      userMsg('u1'),
      thinkingMsg('t1', { durationMs: 300 }),
      thinkingMsg('t2', { inProgress: true }),
    ];
    const out = withReplyProcess(input);
    const s = out.find(m => m.replyProcess)!.replyProcess!;
    expect(s.thinkingCount).toBe(2);
    expect(s.entries).toHaveLength(1); // 只有已封段
    expect(s.liveThinking).toBe('think-t2');
    expect(s.status).toBe('active');
  });

  it('无结果的工具是 liveTool（正在执行），有结果后入抽屉', () => {
    const running = withReplyProcess([
      userMsg('u1'),
      toolMsg('b1', 'Bash', { command: 'python convert.py' }),
    ]);
    const s1 = running.find(m => m.replyProcess)!.replyProcess!;
    expect(s1.liveTool).toEqual({ actionLabel: '运行命令', summary: 'python convert.py' });
    expect(s1.entries).toHaveLength(0);

    const done = withReplyProcess([
      userMsg('u1'),
      toolMsg('b1', 'Bash', { command: 'python convert.py' }, { content: 'ok' }),
    ]);
    const s2 = done.find(m => m.replyProcess)!.replyProcess!;
    expect(s2.liveTool).toBeNull();
    expect(s2.entries).toHaveLength(1);
  });

  it('失败工具计入 errorCount，成功重试自愈为 done', () => {
    const input = [
      userMsg('u1'),
      toolMsg('b1', 'Bash', { command: 'python x.py' }, { content: 'fail', isError: true }),
      toolMsg('b2', 'Bash', { command: 'python3 x.py' }, { content: 'ok' }),
      textMsg('a1', '完成'),
      userMsg('u2'),
    ];
    const out = withReplyProcess(input);
    const s = out.find(m => m.replyProcess)!.replyProcess!;
    expect(s.errorCount).toBe(1);
    expect(s.status).toBe('done'); // 自愈：最后一次失败后有成功
  });

  it('连续失败无自愈 → error 态', () => {
    const input = [
      userMsg('u1'),
      toolMsg('b1', 'Bash', { command: 'a' }, { content: 'f1', isError: true }),
      toolMsg('b2', 'Bash', { command: 'b' }, { content: 'f2', isError: true }),
      textMsg('a1', '正文'),
      userMsg('u2'),
    ];
    const out = withReplyProcess(input);
    const s = out.find(m => m.replyProcess)!.replyProcess!;
    expect(s.status).toBe('error');
    expect(s.errorCount).toBe(2);
  });

  it('交互提问卡与错误消息不被吸收，留在主流', () => {
    const question = {
      ...toolMsg('q1', 'AskUserQuestion', { questions: [] }),
      interactiveQuestion: { toolUseID: 'q1', questions: [] },
    } as ChatMessage;
    const input = [
      userMsg('u1'),
      thinkingMsg('t1', { durationMs: 100 }),
      question,
      { id: 'e1', type: 'error', content: 'boom', timestamp: 1 } as ChatMessage,
    ];
    const out = withReplyProcess(input);
    expect(out.some(m => m.id === 'q1')).toBe(true);
    expect(out.some(m => m.id === 'e1')).toBe(true);
    const s = out.find(m => m.replyProcess)!.replyProcess!;
    expect(s.absorbedIds).not.toContain('q1');
  });

  it('任务工具跳过（归 taskListAggregator）', () => {
    const input = [
      userMsg('u1'),
      toolMsg('tc1', 'TaskCreate', { subject: 'x' }, { content: 'ok' }),
      thinkingMsg('t1', { durationMs: 100 }),
    ];
    const out = withReplyProcess(input);
    expect(out.some(m => m.id === 'tc1')).toBe(true);
    const s = out.find(m => m.replyProcess)!.replyProcess!;
    expect(s.toolCount).toBe(0);
  });

  it('旁白吸收进组（正文前无独立气泡），按时间序落时间线', () => {
    const input = [
      userMsg('u1'),
      textMsg('n1', '让我检查一下源文件：'),
      toolMsg('b1', 'Read', { file_path: '/a' }, { content: 'x' }),
    ];
    const out = withReplyProcess(input);
    // 旁白被吸收（不独立输出）
    expect(out.some(m => m.id === 'n1')).toBe(false);
    const s = out.find(m => m.replyProcess)!.replyProcess!;
    expect(s.entries.some(e => e.kind === 'narration' && e.text === '让我检查一下源文件：')).toBe(true);
  });

  it('长旁白（>60 字、<300 字、后跟工具）吸收进组，不冒充正文', () => {
    // 回归：agentic 干活前旁白常超旧 60 字阈值，曾被当正文渲染，
    // 出现"回答都出了还在思考"的心智错乱
    const longNarration = '我来对生成的 PCT-0026pct-完整版.docx 进行全面验证。验证发现 claim_count 只有 10 项，不符合 software-20 要求的 20 项权利要求结构，让我进一步检查源文件和 OfficeCLI 修订痕迹情况。';
    expect(longNarration.length).toBeGreaterThan(60);
    const input = [
      userMsg('u1'),
      thinkingMsg('t1', { durationMs: 500 }),
      textMsg('n1', longNarration),
      toolMsg('b1', 'Bash', { command: 'officecli validate /work' }, { content: 'ok' }),
    ];
    const out = withReplyProcess(input);
    expect(out.some(m => m.id === 'n1')).toBe(false); // 不在主流冒充正文
    const s = out.find(m => m.replyProcess)!.replyProcess!;
    expect(s.entries.some(e => e.kind === 'narration' && e.text === longNarration)).toBe(true);
    // 时间线顺序：思考 → 旁白（在工具之前，按说出时刻）
    const kinds = s.entries.map(e => e.kind);
    expect(kinds).toEqual(['thinking', 'narration', 'tool']);
  });

  it('带 markdown 结构的长文本不吸收（是正文，安全阀）', () => {
    const input = [
      userMsg('u1'),
      textMsg('a1', '## 验证结论\n- claim_count 不达标\n- 详见下文'),
      toolMsg('b1', 'Read', { file_path: '/a' }, { content: 'x' }),
    ];
    const out = withReplyProcess(input);
    expect(out.some(m => m.id === 'a1')).toBe(true); // 正文透传
  });

  it('输入消息对象永不被修改（防突变回归）', () => {
    const input = [
      userMsg('u1'),
      textMsg('n1', '过渡句'),
      toolMsg('b1', 'Bash', { command: 'ls' }, { content: 'ok' }),
      thinkingMsg('t1', { durationMs: 100 }),
    ];
    const snapshot = JSON.stringify(input);
    withReplyProcess(input);
    withReplyProcess(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('重复执行幂等', () => {
    const input = [
      userMsg('u1'),
      thinkingMsg('t1', { durationMs: 100 }),
      toolMsg('b1', 'Bash', { command: 'ls' }, { content: 'ok' }),
      textMsg('a1', '正文'),
    ];
    expect(withReplyProcess(input)).toEqual(withReplyProcess(input));
  });

  it('无过程内容的回复不产生组头（零影响）', () => {
    const input = [userMsg('u1'), textMsg('a1', '直接回答')];
    const out = withReplyProcess(input);
    expect(out).toEqual(input);
  });
});
