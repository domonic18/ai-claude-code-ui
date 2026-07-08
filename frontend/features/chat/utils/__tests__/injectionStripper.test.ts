/**
 * injectionStripper 单测
 */
import { describe, it, expect } from 'vitest';
import { stripInjectedWrappers } from '../injectionStripper';

describe('stripInjectedWrappers', () => {
  it('剥离前导 skill 注入块，保留用户原话', () => {
    const text = '<ccui-inject type="skill">请使用 "patent-disclosure" skill 完成此任务。</ccui-inject>\n\n这个技能说了什么';
    expect(stripInjectedWrappers(text)).toBe('这个技能说了什么');
  });

  it('无注入块时原样返回', () => {
    expect(stripInjectedWrappers('帮我写一份交底书')).toBe('帮我写一份交底书');
  });

  it('空字符串/空值安全返回', () => {
    expect(stripInjectedWrappers('')).toBe('');
    expect(stripInjectedWrappers(null as unknown as string)).toBe(null);
  });

  it('幂等：对已剥离文本再跑一次不变', () => {
    const cleaned = '这个技能说了什么';
    expect(stripInjectedWrappers(cleaned)).toBe(cleaned);
  });

  it('支持多个注入块全部剥离', () => {
    const text = '<ccui-inject type="skill">A</ccui-inject>\n\n<ccui-inject type="x">B</ccui-inject>\n用户正文';
    expect(stripInjectedWrappers(text)).toBe('用户正文');
  });
});
