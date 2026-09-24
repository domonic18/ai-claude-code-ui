/**
 * stageStatus 单测
 *
 * 覆盖：阶段推断（思考中/工具执行中/响应中/分析中）、用户消息边界、
 * 合成消息跳过、分析中文案时间升级。
 */
import { describe, it, expect } from 'vitest';
import { inferStreamStage, analyzingLabel, ANALYZING_ESCALATE_MS, ANALYZING_LONG_WAIT_MS } from '../stageStatus';
import type { ChatMessage } from '../../types';

function userMsg(id: string): ChatMessage {
  return { id, type: 'user', content: 'q', timestamp: 1 };
}
function toolMsg(id: string, toolName: string, withResult = true): ChatMessage {
  return {
    id, type: 'assistant', content: '', timestamp: 1,
    isToolUse: true, toolName,
    ...(withResult ? { toolResult: { content: 'ok' } } : {}),
  };
}
function thinkingMsg(id: string, inProgress: boolean): ChatMessage {
  return {
    id, type: 'assistant', content: '', timestamp: 1,
    isThinking: true, thinking: 't', thinkingInProgress: inProgress,
  };
}
function assistantMsg(id: string, streaming = false): ChatMessage {
  return { id, type: 'assistant', content: 'text', timestamp: 1, isStreaming: streaming };
}

describe('inferStreamStage', () => {
  it('未封段思考块 → thinking', () => {
    const stage = inferStreamStage([userMsg('u'), thinkingMsg('t', true)]);
    expect(stage.stage).toBe('thinking');
  });

  it('工具调用无结果 → tool-running（带工具名）', () => {
    const stage = inferStreamStage([userMsg('u'), toolMsg('b', 'Bash', false)]);
    expect(stage.stage).toBe('tool-running');
    expect(stage.toolName).toBe('Bash');
  });

  it('工具调用有结果 → analyzing（空窗）', () => {
    const stage = inferStreamStage([userMsg('u'), toolMsg('b', 'Bash', true)]);
    expect(stage.stage).toBe('analyzing');
  });

  it('流式正文消息 → responding', () => {
    const stage = inferStreamStage([userMsg('u'), assistantMsg('a', true)]);
    expect(stage.stage).toBe('responding');
  });

  it('封段完成的思考块跳过，继续向前扫', () => {
    const stage = inferStreamStage([userMsg('u'), thinkingMsg('t', false), toolMsg('b', 'Grep', false)]);
    expect(stage.stage).toBe('tool-running');
  });

  it('用户消息是扫描边界：之前的工具 pending 不影响', () => {
    const stage = inferStreamStage([toolMsg('b1', 'Bash', false), userMsg('u'), toolMsg('b2', 'Bash', true)]);
    expect(stage.stage).toBe('analyzing');
  });

  it('空消息数组 → analyzing', () => {
    expect(inferStreamStage([]).stage).toBe('analyzing');
  });
});

describe('analyzingLabel', () => {
  it('时间升级三级文案', () => {
    expect(analyzingLabel(0)).toBe('正在思考下一步...');
    expect(analyzingLabel(ANALYZING_ESCALATE_MS)).toContain('仍在处理中');
    expect(analyzingLabel(ANALYZING_LONG_WAIT_MS)).toContain('等待模型响应');
  });
});
