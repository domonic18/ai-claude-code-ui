/**
 * phaseAggregator 单测
 *
 * 覆盖：轻量事件吸收（Glob/Grep/Read/Skill/自检 Bash）、Bash 命令模式
 * 匹配（自检脚本/版本探测 vs 重操作）、阶段边界收口（重事件/用户消息）、
 * 失败项异常态、思考段吸收、安全阀强制收口、纯函数幂等性。
 */
import { describe, it, expect } from 'vitest';
import { withAggregatedPhases, isLightEvent } from '../phaseAggregator';
import type { ChatMessage } from '../../types';

/** 构造工具调用消息的辅助函数 */
function toolMsg(id: string, toolName: string, input: any, toolResult?: any): ChatMessage {
  return {
    id,
    type: 'assistant',
    content: '',
    timestamp: 1,
    isToolUse: true,
    toolName,
    toolInput: JSON.stringify(input),
    ...(toolResult !== undefined ? { toolResult } : {}),
  };
}

/** 构造思考段消息的辅助函数 */
function thinkingMsg(id: string): ChatMessage {
  return {
    id,
    type: 'assistant',
    content: '',
    timestamp: 1,
    isThinking: true,
    thinking: `thinking-${id}`,
  };
}

/** 构造普通文本消息的辅助函数 */
function textMsg(id: string): ChatMessage {
  return { id, type: 'assistant', content: `text-${id}`, timestamp: 1 };
}

describe('isLightEvent', () => {
  it('Glob/Grep/Read/Skill 无条件轻量', () => {
    expect(isLightEvent(toolMsg('1', 'Glob', { pattern: '**/*.ts' }))).toBe(true);
    expect(isLightEvent(toolMsg('2', 'Grep', { pattern: 'foo' }))).toBe(true);
    expect(isLightEvent(toolMsg('3', 'Read', { file_path: '/a' }))).toBe(true);
    expect(isLightEvent(toolMsg('4', 'Skill', { skill: 'docx' }))).toBe(true);
  });

  it('Bash 自检/探测命令为轻量', () => {
    expect(isLightEvent(toolMsg('1', 'Bash', { command: 'python scripts/officecli_self_check.py' }))).toBe(true);
    expect(isLightEvent(toolMsg('2', 'Bash', { command: 'python scripts/chinese-pct-docx-toolkit/pct_selftest.py' }))).toBe(true);
    expect(isLightEvent(toolMsg('3', 'Bash', { command: 'officecli --version' }))).toBe(true);
    expect(isLightEvent(toolMsg('4', 'Bash', { command: 'command -v pandoc && which dot' }))).toBe(true);
    expect(isLightEvent(toolMsg('5', 'Bash', { command: 'ls /workspace' }))).toBe(true);
    expect(isLightEvent(toolMsg('6', 'Bash', { command: 'python3 /workspace/.claude/skills/patent-chinese-pct-docx/scripts/setup.py' }))).toBe(true); // 技能 scripts/ 支撑脚本
    expect(isLightEvent(toolMsg('7', 'Bash', { command: 'mkdir -p /workspace/测试1/generated_docs' }))).toBe(true); // 准备目录
  });

  it('Bash 重操作不轻量', () => {
    expect(isLightEvent(toolMsg('1', 'Bash', { command: 'grep -rn "thinking" /app' }))).toBe(false);
    expect(isLightEvent(toolMsg('2', 'Bash', { command: 'npm run build' }))).toBe(false);
    expect(isLightEvent(toolMsg('3', 'Bash', { command: 'curl -sS https://api.example.com' }))).toBe(false);
    expect(isLightEvent(toolMsg('4', 'Bash', { command: 'cd /app && ls' }))).toBe(false); // ls 非行首
    expect(isLightEvent(toolMsg('5', 'Bash', { command: 'python3 -c "import docx; ..." ' }))).toBe(false); // python -c 实干代码不轻量（探测与实干难区分，宁可漏收）
  });

  it('非工具消息与重工具不轻量', () => {
    expect(isLightEvent(textMsg('1'))).toBe(false);
    expect(isLightEvent(toolMsg('2', 'Write', { file_path: '/a', content: 'x' }))).toBe(false);
    expect(isLightEvent(toolMsg('3', 'TaskCreate', { subject: 'x' }))).toBe(false); // 任务工具归 taskListAggregator
  });
});

describe('withAggregatedPhases', () => {
  it('连续轻量事件聚合为单一阶段块，重事件触发收口', () => {
    const input = [
      toolMsg('a', 'Skill', { skill: 'docx' }),
      toolMsg('b', 'Glob', { pattern: '**/*.docx' }),
      toolMsg('c', 'Bash', { command: 'officecli --version' }),
      toolMsg('d', 'Read', { file_path: '/x' }),
      toolMsg('e', 'Write', { file_path: '/y', content: 'real work' }), // 重事件
    ];
    const out = withAggregatedPhases(input);
    // 阶段块（1）+ Write（1）= 2 条
    expect(out).toHaveLength(2);
    const phase = out[0];
    expect(phase.phaseSnapshot).toBeDefined();
    expect(phase.phaseSnapshot!.status).toBe('done');
    expect(phase.phaseSnapshot!.events).toHaveLength(4);
    expect(phase.phaseSnapshot!.absorbedIds).toEqual(['a', 'b', 'c', 'd']);
    expect(out[1].id).toBe('e');
  });

  it('用户消息触发收口', () => {
    const input: ChatMessage[] = [
      toolMsg('a', 'Glob', { pattern: '*' }),
      { id: 'u', type: 'user', content: 'hi', timestamp: 1 },
      toolMsg('b', 'Glob', { pattern: '**' }), // 收口后新块
    ];
    const out = withAggregatedPhases(input);
    // 用户消息 + 块1(done) + 块2(active)
    const phases = out.filter(m => m.phaseSnapshot);
    expect(phases).toHaveLength(2);
    expect(phases[0].phaseSnapshot!.status).toBe('done');
    expect(phases[1].phaseSnapshot!.status).toBe('active'); // 会话未结束保持进行中
  });

  it('失败项置异常态并收口', () => {
    const input = [
      toolMsg('a', 'Glob', { pattern: '*' }),
      toolMsg('b', 'Bash', { command: 'python selftest.py' }, { content: 'FAIL', isError: true }),
    ];
    const out = withAggregatedPhases(input);
    const phase = out.find(m => m.phaseSnapshot)!;
    expect(phase.phaseSnapshot!.status).toBe('error');
    expect(phase.phaseSnapshot!.events[1].isError).toBe(true);
  });

  it('聚合期间的思考段被吸收，收口后的思考段独立保留', () => {
    const input = [
      toolMsg('a', 'Glob', { pattern: '*' }),
      thinkingMsg('t1'),
      toolMsg('w', 'Write', { file_path: '/y', content: 'x' }), // 收口
      thinkingMsg('t2'), // 收口后：独立消息
    ];
    const out = withAggregatedPhases(input);
    const phase = out.find(m => m.phaseSnapshot)!;
    expect(phase.phaseSnapshot!.thinkingSegments).toHaveLength(1);
    expect(phase.phaseSnapshot!.thinkingSegments[0].thinking).toBe('thinking-t1');
    // t2 不被吸收
    expect(out.some(m => m.id === 't2')).toBe(true);
  });

  it('无轻量事件时原样返回（零影响）', () => {
    const input = [textMsg('a'), toolMsg('b', 'Write', { file_path: '/c', content: 'x' })];
    const out = withAggregatedPhases(input);
    expect(out).toEqual(input);
  });

  it('安全阀：超过 30 个事件强制收口开新块', () => {
    const input: ChatMessage[] = [];
    for (let i = 0; i < 35; i++) {
      input.push(toolMsg(`g${i}`, 'Glob', { pattern: '*' }));
    }
    const out = withAggregatedPhases(input);
    const phases = out.filter(m => m.phaseSnapshot);
    expect(phases.length).toBeGreaterThanOrEqual(2);
    expect(phases[0].phaseSnapshot!.events.length).toBeLessThanOrEqual(30);
  });

  it('纯函数幂等：同一输入两次调用结果一致', () => {
    const input = [
      toolMsg('a', 'Glob', { pattern: '*' }),
      thinkingMsg('t1'),
      toolMsg('w', 'Write', { file_path: '/y', content: 'x' }),
    ];
    const out1 = withAggregatedPhases(input);
    const out2 = withAggregatedPhases(input);
    expect(out1).toEqual(out2);
  });
});
